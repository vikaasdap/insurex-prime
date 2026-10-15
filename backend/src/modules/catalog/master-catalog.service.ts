import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Database } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { InsuranceType } from "../../generated/prisma/enums.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { toNullableNumber } from "../../utils/format.js";
import { recordAudit } from "../audit-logs/audit-logs.service.js";
import { enabledLines, LINE_ORDER, makePolicyCode, policyCodePrefix } from "./catalog.service.js";
import type {
  createMasterCategoryBodySchema,
  createMasterPoliciesBodySchema,
} from "./master-catalog.schemas.js";
import { getCatalogTemplate } from "./templates/index.js";
import type { CatalogTemplate, CategoryTemplate, PolicyTemplate } from "./templates/types.js";

type Reader = Pick<Database, "masterCategory" | "masterPolicy">;

const policyOrder = [{ policyName: "asc" }, { id: "asc" }] as const;

// ─── Reading ──────────────────────────────────────────────────────────────────

const toMasterPolicy = (policy: {
  id: string;
  policyCode: string;
  policyName: string;
  uin: string;
}) => ({
  id: policy.id,
  policyCode: policy.policyCode,
  policyName: policy.policyName,
  uin: policy.uin,
});

/** Every active insurer with its master catalog: line → category → sub-category → policy. */
export async function getMasterCatalog(db: Database) {
  const [insurers, categories, policies] = await Promise.all([
    db.insurer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.masterCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.masterPolicy.findMany({ orderBy: [...policyOrder] }),
  ]);
  return insurers.map((insurer) => {
    const mine = categories.filter((category) => category.insurerId === insurer.id);
    const policiesIn = (categoryId: string | null, line: InsuranceType) =>
      policies
        .filter(
          (policy) =>
            policy.insurerId === insurer.id &&
            policy.categoryId === categoryId &&
            policy.insuranceType === line,
        )
        .map(toMasterPolicy);
    const lines = LINE_ORDER.map((line) => ({
      line,
      categories: mine
        .filter((category) => category.line === line && !category.parentId)
        .map((root) => ({
          id: root.id,
          name: root.name,
          policies: policiesIn(root.id, line),
          subCategories: mine
            .filter((category) => category.parentId === root.id)
            .map((sub) => ({ id: sub.id, name: sub.name, policies: policiesIn(sub.id, line) })),
        })),
      policies: policiesIn(null, line),
    })).filter((line) => line.categories.length > 0 || line.policies.length > 0);
    return { insurer: { id: insurer.id, code: insurer.code, name: insurer.name }, lines };
  });
}

/** Lines that have master content, per insurer (drives the default ticks when onboarding). */
export async function masterLinesByInsurer(db: Reader) {
  const [categories, policies] = await Promise.all([
    db.masterCategory.groupBy({ by: ["insurerId", "line"] }),
    db.masterPolicy.groupBy({ by: ["insurerId", "insuranceType"] }),
  ]);
  const result = new Map<string, Set<InsuranceType>>();
  const add = (insurerId: string, line: InsuranceType) =>
    result.set(insurerId, (result.get(insurerId) ?? new Set()).add(line));
  for (const row of categories) add(row.insurerId, row.line);
  for (const row of policies) add(row.insurerId, row.insuranceType);
  return result;
}

/** The master catalog as an installable template, or null when the insurer has none yet. */
export async function loadMasterTemplate(
  db: Reader,
  insurerId: string,
): Promise<CatalogTemplate | null> {
  const [categories, policies] = await Promise.all([
    db.masterCategory.findMany({
      where: { insurerId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.masterPolicy.findMany({ where: { insurerId }, orderBy: [...policyOrder] }),
  ]);
  if (categories.length === 0 && policies.length === 0) return null;

  const toPolicy = (policy: (typeof policies)[number]): PolicyTemplate => ({
    name: policy.policyName,
    policyCode: policy.policyCode,
    uin: policy.uin,
    description: policy.description,
    ...(policy.coverageAmount !== null ? { coverageAmount: toNullableNumber(policy.coverageAmount)! } : {}),
    ...(policy.premium !== null ? { premium: toNullableNumber(policy.premium)! } : {}),
    ...(policy.durationMonths !== null ? { durationMonths: policy.durationMonths } : {}),
    benefits: policy.benefits,
    ...(policy.categoryDetails
      ? { categoryDetails: policy.categoryDetails as unknown as PolicyTemplate["categoryDetails"] }
      : {}),
  });
  const policiesIn = (categoryId: string | null, line: InsuranceType) =>
    policies
      .filter((policy) => policy.categoryId === categoryId && policy.insuranceType === line)
      .map(toPolicy);
  const nested = (parentId: string, line: InsuranceType): CategoryTemplate[] =>
    categories
      .filter((category) => category.parentId === parentId)
      .map((sub) => ({ name: sub.name, policies: policiesIn(sub.id, line) }));

  return LINE_ORDER.map((line) => ({
    line,
    policies: policiesIn(null, line),
    categories: categories
      .filter((category) => category.line === line && !category.parentId)
      .map((root) => ({
        name: root.name,
        policies: policiesIn(root.id, line),
        categories: nested(root.id, line),
      })),
  })).filter((item) => (item.policies?.length ?? 0) > 0 || (item.categories?.length ?? 0) > 0);
}

/** The template a new tenant of this insurer starts from: the master catalog, else a built-in list. */
export async function templateForInsurer(
  db: Reader,
  insurer: { id: string; code: string },
): Promise<CatalogTemplate | undefined> {
  return (await loadMasterTemplate(db, insurer.id)) ?? getCatalogTemplate(insurer.code);
}

// ─── Editing ──────────────────────────────────────────────────────────────────

export async function createMasterCategory(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof createMasterCategoryBodySchema>,
) {
  if (!(await db.insurer.findUnique({ where: { id: body.insurerId }, select: { id: true } }))) {
    throw notFound("Insurer");
  }
  const parent = body.parentId
    ? await db.masterCategory.findUnique({ where: { id: body.parentId } })
    : null;
  if (body.parentId) {
    if (!parent || parent.insurerId !== body.insurerId) {
      throw badRequest("parentId does not refer to a category of this insurer.");
    }
    if (parent.parentId) {
      throw badRequest("Categories can only be nested one level (category → sub-category).");
    }
    if (parent.line !== body.line) {
      throw badRequest(`The parent category belongs to the ${parent.line} line.`);
    }
  }
  const siblings = await db.masterCategory.findMany({
    where: { insurerId: body.insurerId, line: body.line, parentId: body.parentId ?? null },
    select: { name: true, sortOrder: true },
  });
  if (siblings.some((item) => item.name.toLowerCase() === body.name.toLowerCase())) {
    throw conflict(`A category named "${body.name}" already exists here.`);
  }
  const created = await db.$transaction(async (tx) => {
    const category = await tx.masterCategory.create({
      data: {
        insurerId: body.insurerId,
        line: body.line,
        parentId: body.parentId ?? null,
        name: body.name,
        sortOrder: siblings.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0),
      },
    });
    await recordAudit(tx, request, {
      action: "master_catalog.category_create",
      entity: "MasterCategory",
      entityId: category.id,
      tenantId: null,
      metadata: { name: category.name, line: category.line },
    });
    return category;
  });
  return { id: created.id, name: created.name };
}

export async function createMasterPolicies(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof createMasterPoliciesBodySchema>,
) {
  const insurer = await db.insurer.findUnique({ where: { id: body.insurerId } });
  if (!insurer) throw notFound("Insurer");
  if (body.categoryId) {
    const category = await db.masterCategory.findUnique({ where: { id: body.categoryId } });
    if (!category || category.insurerId !== insurer.id) {
      throw badRequest("categoryId does not refer to a category of this insurer.");
    }
    if (category.line !== body.insuranceType) {
      throw badRequest(`That category belongs to the ${category.line} line.`);
    }
  }
  const names = body.policies.map((item) => item.policyName.toLowerCase());
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated) throw conflict(`"${repeated}" is listed twice.`);
  const present = await db.masterPolicy.findMany({
    where: { insurerId: insurer.id, categoryId: body.categoryId ?? null, insuranceType: body.insuranceType },
    select: { policyName: true },
  });
  const clash = present.find((item) => names.includes(item.policyName.toLowerCase()));
  if (clash) throw conflict(`"${clash.policyName}" already exists in this category.`);

  const used = new Set(
    (await db.masterPolicy.findMany({ where: { insurerId: insurer.id }, select: { policyCode: true } })).map(
      (row) => row.policyCode,
    ),
  );
  const prefix = policyCodePrefix(insurer.code);
  const rows = body.policies.map((item) => {
    if (item.policyCode) {
      if (used.has(item.policyCode)) throw conflict(`The policy code ${item.policyCode} is already in use.`);
      used.add(item.policyCode);
    }
    return { ...item, policyCode: item.policyCode ?? makePolicyCode(prefix, item.policyName, used) };
  });

  const created = await db.$transaction(async (tx) => {
    const made = await Promise.all(
      rows.map((row) =>
        tx.masterPolicy.create({
          data: {
            insurerId: insurer.id,
            categoryId: body.categoryId ?? null,
            insuranceType: body.insuranceType,
            policyCode: row.policyCode,
            policyName: row.policyName,
            uin: row.uin,
          },
        }),
      ),
    );
    await recordAudit(tx, request, {
      action: "master_catalog.policies_create",
      entity: "MasterPolicy",
      entityId: made[0]!.id,
      tenantId: null,
      metadata: { insurer: insurer.code, count: made.length },
    });
    return made;
  });
  return { created: created.length };
}

export async function deleteMasterCategory(db: Database, request: FastifyRequest, id: string) {
  const category = await db.masterCategory.findUnique({
    where: { id },
    include: { _count: { select: { children: true, policies: true } } },
  });
  if (!category) throw notFound("Category");
  if (category._count.children > 0 || category._count.policies > 0) {
    throw conflict("Remove the sub-categories and policies inside it first.");
  }
  await db.$transaction(async (tx) => {
    await tx.masterCategory.delete({ where: { id } });
    await recordAudit(tx, request, {
      action: "master_catalog.category_delete",
      entity: "MasterCategory",
      entityId: id,
      tenantId: null,
      metadata: { name: category.name },
    });
  });
  return { id };
}

export async function deleteMasterPolicy(db: Database, request: FastifyRequest, id: string) {
  const policy = await db.masterPolicy.findUnique({ where: { id } });
  if (!policy) throw notFound("Policy");
  await db.$transaction(async (tx) => {
    await tx.masterPolicy.delete({ where: { id } });
    await recordAudit(tx, request, {
      action: "master_catalog.policy_delete",
      entity: "MasterPolicy",
      entityId: id,
      tenantId: null,
      metadata: { policyCode: policy.policyCode },
    });
  });
  return { id };
}

// ─── Applying the master catalog to agencies that already exist ───────────────

/**
 * Adds whatever the master catalog has and a tenant's own catalog lacks, for every active tenant
 * that sells for this insurer (only the lines each tenant has enabled). It never renames,
 * removes or overwrites anything an agency already has.
 */
export async function syncMasterToTenants(db: Database, request: FastifyRequest, insurerId: string) {
  const insurer = await db.insurer.findUnique({ where: { id: insurerId } });
  if (!insurer) throw notFound("Insurer");
  const [categories, policies, links] = await Promise.all([
    db.masterCategory.findMany({
      where: { insurerId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.masterPolicy.findMany({ where: { insurerId }, orderBy: [...policyOrder] }),
    db.tenantInsurer.findMany({
      where: { insurerId, tenant: { status: "ACTIVE" } },
      select: { tenantId: true, lines: true },
    }),
  ]);
  const prefix = policyCodePrefix(insurer.code);
  const totals = { tenants: links.length, categoriesAdded: 0, policiesAdded: 0 };

  for (const link of links) {
    const allowed = enabledLines(link);
    await db.$transaction(
      async (tx) => {
        const tenantId = link.tenantId;
        const used = new Set(
          (await tx.policy.findMany({ where: { tenantId }, select: { policyCode: true } })).map(
            (row) => row.policyCode,
          ),
        );
        const tenantCategories = await tx.policyCategory.findMany({ where: { tenantId, insurerId } });
        const tenantPolicies = await tx.policy.findMany({
          where: { tenantId, insurerId },
          select: { policyName: true, categoryId: true, insuranceType: true },
        });
        const idOf = new Map<string, string>(); // master category id → this tenant's category id

        const ensureCategory = async (master: (typeof categories)[number], parentId: string | null) => {
          const found = tenantCategories.find(
            (item) =>
              item.line === master.line &&
              item.parentId === parentId &&
              item.name.toLowerCase() === master.name.toLowerCase(),
          );
          if (found) return found.id;
          const created = await tx.policyCategory.create({
            data: {
              tenantId,
              insurerId,
              line: master.line,
              parentId,
              name: master.name,
              sortOrder: master.sortOrder,
            },
          });
          tenantCategories.push(created);
          totals.categoriesAdded += 1;
          return created.id;
        };

        for (const root of categories.filter((c) => !c.parentId && allowed.includes(c.line))) {
          idOf.set(root.id, await ensureCategory(root, null));
        }
        for (const sub of categories.filter((c) => c.parentId && allowed.includes(c.line))) {
          const parent = idOf.get(sub.parentId!);
          if (parent) idOf.set(sub.id, await ensureCategory(sub, parent));
        }

        for (const policy of policies.filter((p) => allowed.includes(p.insuranceType))) {
          const categoryId = policy.categoryId ? (idOf.get(policy.categoryId) ?? null) : null;
          if (policy.categoryId && !categoryId) continue; // its category is not enabled here
          const exists = tenantPolicies.some(
            (item) =>
              item.categoryId === categoryId &&
              item.insuranceType === policy.insuranceType &&
              item.policyName.toLowerCase() === policy.policyName.toLowerCase(),
          );
          if (exists) continue;
          const code = used.has(policy.policyCode)
            ? makePolicyCode(prefix, policy.policyName, used)
            : (used.add(policy.policyCode), policy.policyCode);
          await tx.policy.create({
            data: {
              tenantId,
              insurerId,
              categoryId,
              insuranceType: policy.insuranceType,
              policyCode: code,
              policyName: policy.policyName,
              uin: policy.uin,
              description: policy.description,
              coverageAmount: policy.coverageAmount,
              premium: policy.premium,
              durationMonths: policy.durationMonths,
              benefits: policy.benefits,
              ...(policy.categoryDetails
                ? { categoryDetails: policy.categoryDetails as Prisma.InputJsonValue }
                : {}),
            },
          });
          totals.policiesAdded += 1;
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  await recordAudit(db, request, {
    action: "master_catalog.sync_tenants",
    entity: "Insurer",
    entityId: insurerId,
    tenantId: null,
    metadata: totals,
  });
  return totals;
}

// ─── One-off: copy the built-in lists into the master catalog ─────────────────

/** Inserts a template into an insurer's master catalog when it has none yet. */
export async function seedMasterFromTemplate(
  db: Database,
  insurer: { id: string; code: string },
  template: CatalogTemplate,
) {
  const existing =
    (await db.masterCategory.count({ where: { insurerId: insurer.id } })) +
    (await db.masterPolicy.count({ where: { insurerId: insurer.id } }));
  if (existing > 0) return { skipped: true, categories: 0, policies: 0 };

  const prefix = policyCodePrefix(insurer.code);
  const used = new Set<string>();
  const counts = { skipped: false, categories: 0, policies: 0 };

  await db.$transaction(
    async (tx) => {
      const insertPolicies = async (
        line: InsuranceType,
        categoryId: string | null,
        list: PolicyTemplate[] | undefined,
      ) => {
        for (const policy of list ?? []) {
          const code =
            policy.policyCode && !used.has(policy.policyCode)
              ? (used.add(policy.policyCode), policy.policyCode)
              : makePolicyCode(prefix, policy.name, used);
          await tx.masterPolicy.create({
            data: {
              insurerId: insurer.id,
              categoryId,
              insuranceType: line,
              policyCode: code,
              policyName: policy.name,
              uin: policy.uin ?? "",
              description: policy.description ?? "",
              coverageAmount: policy.coverageAmount ?? null,
              premium: policy.premium ?? null,
              durationMonths: policy.durationMonths ?? null,
              benefits: policy.benefits ?? [],
              ...(policy.categoryDetails
                ? { categoryDetails: policy.categoryDetails as Prisma.InputJsonValue }
                : {}),
            },
          });
          counts.policies += 1;
        }
      };
      const insertCategories = async (
        line: InsuranceType,
        parentId: string | null,
        list: CategoryTemplate[] | undefined,
      ) => {
        for (const [index, category] of (list ?? []).entries()) {
          const created = await tx.masterCategory.create({
            data: { insurerId: insurer.id, line, parentId, name: category.name, sortOrder: index },
          });
          counts.categories += 1;
          await insertPolicies(line, created.id, category.policies);
          await insertCategories(line, created.id, category.categories);
        }
      };
      for (const line of template) {
        await insertPolicies(line.line, null, line.policies);
        await insertCategories(line.line, null, line.categories);
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return counts;
}

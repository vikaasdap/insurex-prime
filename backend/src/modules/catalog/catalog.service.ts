import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Database } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { InsuranceType } from "../../generated/prisma/enums.js";
import type { AuthContext } from "../../middleware/auth.js";
import { isAdmin, requireTenantId } from "../../middleware/role.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { toNullableNumber } from "../../utils/format.js";
import { recordAudit } from "../audit-logs/audit-logs.service.js";
import type {
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from "./catalog.schemas.js";
import type { CatalogTemplate, CategoryTemplate, PolicyTemplate } from "./templates/types.js";

export const LINE_ORDER: InsuranceType[] = ["LIFE", "HEALTH", "MOTOR", "COMMERCIAL"];

/** Lines a tenant sells for an insurer; rows from before lines were recorded mean every line. */
export const enabledLines = (link: { lines: InsuranceType[] }): InsuranceType[] =>
  link.lines.length > 0 ? link.lines : LINE_ORDER;

/** Rejects adding to a line of business the tenant has not enabled for that insurer. */
export async function assertLineEnabled(
  db: Database,
  tenantId: string,
  insurerId: string,
  line: InsuranceType,
) {
  const link = await db.tenantInsurer.findUnique({
    where: { tenantId_insurerId: { tenantId, insurerId } },
    select: { lines: true },
  });
  if (link && !enabledLines(link).includes(line)) {
    throw badRequest(`This agency does not sell ${line.toLowerCase()} insurance for this insurer.`);
  }
}

// ─── Installing a catalog (tenant activation) ─────────────────────────────────

/** A short readable prefix for policy codes: TATA_AIA → TAIA. Codes are unique per tenant. */
export function policyCodePrefix(insurerCode: string): string {
  return insurerCode
    .split("_")
    .map((word) => (word.length <= 3 ? word : word.slice(0, 1)))
    .join("")
    .slice(0, 8);
}

const NOISE_WORDS = new Set(["LIFE", "INSURANCE"]);

export function makePolicyCode(prefix: string, name: string, used: Set<string>): string {
  const slug = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word && !NOISE_WORDS.has(word))
    .join("-");
  const base = `${prefix}-${slug}`.slice(0, 30).replace(/-+$/, "");
  let code = base;
  for (let attempt = 2; used.has(code); attempt += 1) {
    const suffix = `-${attempt}`;
    code = `${base.slice(0, 30 - suffix.length).replace(/-+$/, "")}${suffix}`;
  }
  used.add(code);
  return code;
}

export interface CatalogCounts {
  categories: number;
  policies: number;
}

/**
 * Writes a catalog tree for a tenant. Runs inside the activation transaction with
 * explicit tenant ids (it is called by the platform, not through a tenant-scoped client).
 */
export async function installCatalog(
  tx: Prisma.TransactionClient,
  tenantId: string,
  insurer: { id: string; code: string },
  template: CatalogTemplate,
): Promise<CatalogCounts> {
  const insurerId = insurer.id;
  const prefix = policyCodePrefix(insurer.code);
  // Codes already used in this tenant (another insurer's catalog may share a prefix).
  const usedCodes = new Set(
    (await tx.policy.findMany({ where: { tenantId }, select: { policyCode: true } })).map(
      (row) => row.policyCode,
    ),
  );
  const counts: CatalogCounts = { categories: 0, policies: 0 };

  /** The template's own code when it is free in this tenant, otherwise one made from the name. */
  const codeFor = (policy: PolicyTemplate) => {
    if (policy.policyCode && !usedCodes.has(policy.policyCode)) {
      usedCodes.add(policy.policyCode);
      return policy.policyCode;
    }
    return makePolicyCode(prefix, policy.name, usedCodes);
  };

  async function insertPolicies(
    line: InsuranceType,
    categoryId: string | null,
    policies: PolicyTemplate[] | undefined,
  ) {
    if (!policies?.length) return;
    await tx.policy.createMany({
      data: policies.map((policy) => ({
        tenantId,
        insurerId,
        categoryId,
        policyCode: codeFor(policy),
        policyName: policy.name,
        uin: policy.uin ?? "",
        insuranceType: line,
        description: policy.description ?? "",
        coverageAmount: policy.coverageAmount ?? null,
        premium: policy.premium ?? null,
        durationMonths: policy.durationMonths ?? null,
        benefits: policy.benefits ?? [],
        ...(policy.categoryDetails
          ? { categoryDetails: policy.categoryDetails as Prisma.InputJsonValue }
          : {}),
      })),
    });
    counts.policies += policies.length;
  }

  async function insertCategories(
    line: InsuranceType,
    parentId: string | null,
    categories: CategoryTemplate[] | undefined,
  ) {
    for (const [index, category] of (categories ?? []).entries()) {
      const created = await tx.policyCategory.create({
        data: { tenantId, insurerId, line, parentId, name: category.name, sortOrder: index },
        select: { id: true },
      });
      counts.categories += 1;
      await insertPolicies(line, created.id, category.policies);
      await insertCategories(line, created.id, category.categories);
    }
  }

  for (const line of template) {
    await insertPolicies(line.line, null, line.policies);
    await insertCategories(line.line, null, line.categories);
  }
  return counts;
}

// ─── Reading the catalog (dropdowns) ──────────────────────────────────────────

const policySelect = {
  id: true,
  policyCode: true,
  policyName: true,
  status: true,
  premium: true,
  coverageAmount: true,
  durationMonths: true,
  categoryId: true,
  insurerId: true,
  insuranceType: true,
} as const;

const toCatalogPolicy = (policy: {
  id: string;
  policyCode: string;
  policyName: string;
  status: "ACTIVE" | "INACTIVE";
  premium: Prisma.Decimal | null;
  coverageAmount: Prisma.Decimal | null;
  durationMonths: number | null;
}) => ({
  id: policy.id,
  policyCode: policy.policyCode,
  policyName: policy.policyName,
  status: policy.status,
  premium: toNullableNumber(policy.premium),
  coverageAmount: toNullableNumber(policy.coverageAmount),
  durationMonths: policy.durationMonths,
});

/** The insurers the tenant sells for, with their licence codes. */
async function tenantInsurers(db: Database, tenantId: string) {
  return db.tenantInsurer.findMany({
    where: { tenantId },
    include: { insurer: { select: { id: true, code: true, name: true } } },
    orderBy: { insurer: { name: "asc" } },
  });
}

/**
 * Which insurer a new category or policy belongs to: the one asked for (it must be one the
 * tenant sells for), or the tenant's only insurer when none is given.
 */
export async function resolveInsurerId(
  db: Database,
  tenantId: string,
  requested: string | null | undefined,
): Promise<string> {
  const links = await tenantInsurers(db, tenantId);
  if (requested) {
    if (!links.some((link) => link.insurerId === requested)) {
      throw badRequest("insurerId is not one of this tenant's insurers.");
    }
    return requested;
  }
  if (links.length === 1) return links[0]!.insurerId;
  throw badRequest("insurerId is required because this tenant sells for several insurers.");
}

/**
 * The tenant's whole catalog as a tree: insurer → line → category → sub-category → policies.
 * Agents only receive ACTIVE policies; admins also see INACTIVE ones.
 */
export async function getCatalogTree(
  db: Database,
  auth: AuthContext,
  filter: { insurerId?: string | undefined; line?: InsuranceType | undefined },
) {
  const tenantId = requireTenantId(auth);
  const [links, categories, policies] = await Promise.all([
    tenantInsurers(db, tenantId),
    db.policyCategory.findMany({
      where: {
        ...(filter.insurerId ? { insurerId: filter.insurerId } : {}),
        ...(filter.line ? { line: filter.line } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.policy.findMany({
      where: {
        ...(filter.insurerId ? { insurerId: filter.insurerId } : {}),
        ...(filter.line ? { insuranceType: filter.line } : {}),
        ...(isAdmin(auth) ? {} : { status: "ACTIVE" }),
      },
      select: policySelect,
      orderBy: [{ policyName: "asc" }, { id: "asc" }],
    }),
  ]);

  const insurers = links
    .filter((link) => !filter.insurerId || link.insurerId === filter.insurerId)
    .map((link) => {
      const policiesIn = (categoryId: string | null, line: InsuranceType) =>
        policies
          .filter(
            (policy) =>
              policy.insurerId === link.insurerId &&
              policy.categoryId === categoryId &&
              policy.insuranceType === line,
          )
          .map(toCatalogPolicy);
      const mine = categories.filter((category) => category.insurerId === link.insurerId);

      const allowed = enabledLines(link);
      const lines = LINE_ORDER.filter((line) => allowed.includes(line)).map((line) => {
        const roots = mine.filter((category) => category.line === line && !category.parentId);
        return {
          line,
          categories: roots.map((root) => ({
            id: root.id,
            name: root.name,
            sortOrder: root.sortOrder,
            policies: policiesIn(root.id, line),
            subCategories: mine
              .filter((category) => category.parentId === root.id)
              .map((sub) => ({
                id: sub.id,
                name: sub.name,
                sortOrder: sub.sortOrder,
                policies: policiesIn(sub.id, line),
              })),
          })),
          policies: policiesIn(null, line),
        };
        // Admins see an enabled line even while it is empty, so they can start filling it.
      }).filter((line) => isAdmin(auth) || line.categories.length > 0 || line.policies.length > 0);

      return { insurer: link.insurer, businessCode: link.businessCode, lines };
    });

  return { insurers };
}

// ─── Category management ──────────────────────────────────────────────────────

type CategoryRecord = Prisma.PolicyCategoryGetPayload<{
  include: { _count: { select: { policies: true } } };
}>;

const toCategoryDto = (category: CategoryRecord) => ({
  id: category.id,
  insurerId: category.insurerId,
  line: category.line,
  parentId: category.parentId,
  name: category.name,
  sortOrder: category.sortOrder,
  policyCount: category._count.policies,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

const categoryInclude = { _count: { select: { policies: true } } } as const;

export async function listCategories(
  db: Database,
  query: z.infer<typeof listCategoriesQuerySchema>,
) {
  const categories = await db.policyCategory.findMany({
    where: {
      ...(query.insurerId ? { insurerId: query.insurerId } : {}),
      ...(query.line ? { line: query.line } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.topLevel ? { parentId: null } : {}),
    },
    include: categoryInclude,
    orderBy: [{ line: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return categories.map(toCategoryDto);
}

async function assertNameFree(
  db: Database,
  where: { insurerId: string; line: InsuranceType; parentId: string | null; name: string },
  exceptId?: string,
) {
  const sibling = await db.policyCategory.findFirst({
    where: {
      insurerId: where.insurerId,
      line: where.line,
      parentId: where.parentId,
      name: { equals: where.name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (sibling) throw conflict(`A category named "${where.name}" already exists here.`);
}

export async function createCategory(
  db: Database,
  auth: AuthContext,
  request: FastifyRequest,
  body: z.infer<typeof createCategoryBodySchema>,
) {
  const parentId = body.parentId ?? null;
  const parent = parentId ? await db.policyCategory.findUnique({ where: { id: parentId } }) : null;
  if (parentId) {
    if (!parent) throw badRequest("parentId does not refer to a category in this catalog.");
    if (parent.parentId) {
      throw badRequest("Categories can only be nested one level (category → sub-category).");
    }
    if (parent.line !== body.line) {
      throw badRequest(`The parent category belongs to the ${parent.line} line.`);
    }
    if (body.insurerId && body.insurerId !== parent.insurerId) {
      throw badRequest("The parent category belongs to a different insurer.");
    }
  }
  // A sub-category always belongs to its parent's insurer.
  const insurerId = parent
    ? parent.insurerId
    : await resolveInsurerId(db, requireTenantId(auth), body.insurerId);
  await assertLineEnabled(db, requireTenantId(auth), insurerId, body.line);
  await assertNameFree(db, { insurerId, line: body.line, parentId, name: body.name });

  const category = await db.$transaction(async (tx) => {
    const created = await tx.policyCategory.create({
      data: {
        tenantId: requireTenantId(auth),
        insurerId,
        line: body.line,
        parentId,
        name: body.name,
        sortOrder: body.sortOrder,
      },
      include: categoryInclude,
    });
    await recordAudit(tx, request, {
      action: "category.create",
      entity: "PolicyCategory",
      entityId: created.id,
      metadata: { name: created.name, line: created.line },
    });
    return created;
  });
  return toCategoryDto(category);
}

export async function updateCategory(
  db: Database,
  request: FastifyRequest,
  id: string,
  body: z.infer<typeof updateCategoryBodySchema>,
) {
  const existing = await db.policyCategory.findUnique({ where: { id } });
  if (!existing) throw notFound("Category");
  if (body.name !== undefined) {
    await assertNameFree(
      db,
      {
        insurerId: existing.insurerId,
        line: existing.line,
        parentId: existing.parentId,
        name: body.name,
      },
      id,
    );
  }
  const category = await db.$transaction(async (tx) => {
    const updated = await tx.policyCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
      include: categoryInclude,
    });
    await recordAudit(tx, request, {
      action: "category.update",
      entity: "PolicyCategory",
      entityId: id,
      metadata: { fields: Object.keys(body) },
    });
    return updated;
  });
  return toCategoryDto(category);
}

/** A category with sub-categories or policies cannot be deleted; move or remove those first. */
export async function deleteCategory(db: Database, request: FastifyRequest, id: string) {
  const category = await db.policyCategory.findUnique({
    where: { id },
    include: { _count: { select: { policies: true, children: true } } },
  });
  if (!category) throw notFound("Category");
  if (category._count.children > 0 || category._count.policies > 0) {
    throw conflict(
      `Category has ${category._count.children} sub-categories and ${category._count.policies} policies. Move or delete them first.`,
    );
  }
  await db.$transaction(async (tx) => {
    await tx.policyCategory.delete({ where: { id } });
    await recordAudit(tx, request, {
      action: "category.delete",
      entity: "PolicyCategory",
      entityId: id,
      metadata: { name: category.name },
    });
  });
}

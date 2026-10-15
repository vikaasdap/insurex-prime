import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Database } from "../../config/database.js";
import { Prisma, type Policy } from "../../generated/prisma/client.js";
import type { InsuranceType, PolicyStatus } from "../../generated/prisma/enums.js";
import type { AuthContext } from "../../middleware/auth.js";
import { isAdmin, requireAuth, requireTenantId } from "../../middleware/role.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { toNullableNumber } from "../../utils/format.js";
import { buildMeta, toDateFilter, toSkipTake } from "../../utils/pagination.js";
import { containsInsensitive } from "../../utils/search.js";
import { changedFields, recordAudit } from "../audit-logs/audit-logs.service.js";
import {
  assertLineEnabled,
  makePolicyCode,
  policyCodePrefix,
  resolveInsurerId,
} from "../catalog/catalog.service.js";
import {
  categoryDetailsSchema,
  type CategoryDetails,
  type createPoliciesBulkBodySchema,
  type createPolicyBodySchema,
  type listPoliciesQuerySchema,
  type updatePolicyBodySchema,
} from "./policies.schemas.js";

type PolicyWithCount = Policy & {
  _count?: { soldPolicies: number };
  category?: { id: string; name: string } | null;
  insurer: { id: string; code: string; name: string };
};

const policyInclude = {
  insurer: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true } },
  _count: { select: { soldPolicies: true } },
} as const;

function parseDetails(value: Prisma.JsonValue | null): CategoryDetails | null {
  const parsed = categoryDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const toPolicyDto = (policy: PolicyWithCount, includeSales: boolean) => ({
  id: policy.id,
  policyCode: policy.policyCode,
  policyName: policy.policyName,
  uin: policy.uin,
  insuranceType: policy.insuranceType,
  description: policy.description,
  insurerId: policy.insurerId,
  insurer: policy.insurer,
  categoryId: policy.categoryId,
  category: policy.category ?? null,
  coverageAmount: toNullableNumber(policy.coverageAmount),
  premium: toNullableNumber(policy.premium),
  premiumFrequency: policy.premiumFrequency,
  durationMonths: policy.durationMonths,
  eligibility: policy.eligibility,
  benefits: policy.benefits,
  terms: policy.terms,
  categoryDetails: parseDetails(policy.categoryDetails),
  status: policy.status,
  policiesSold: includeSales ? (policy._count?.soldPolicies ?? 0) : null,
  createdAt: policy.createdAt.toISOString(),
  updatedAt: policy.updatedAt.toISOString(),
});

/** Agents can only ever see ACTIVE catalog policies. */
const policyScope = (auth: AuthContext): Prisma.PolicyWhereInput =>
  isAdmin(auth) ? {} : { status: "ACTIVE" };

export async function listPolicies(
  db: Database,
  auth: AuthContext,
  query: z.infer<typeof listPoliciesQuerySchema>,
) {
  const admin = isAdmin(auth);
  const premium =
    query.premiumMin !== undefined || query.premiumMax !== undefined
      ? {
          ...(query.premiumMin !== undefined ? { gte: query.premiumMin } : {}),
          ...(query.premiumMax !== undefined ? { lte: query.premiumMax } : {}),
        }
      : undefined;
  const where: Prisma.PolicyWhereInput = {
    AND: [
      policyScope(auth),
      admin && query.status ? { status: query.status } : {},
      query.insuranceType ? { insuranceType: query.insuranceType } : {},
      query.insurerId ? { insurerId: query.insurerId } : {},
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.premiumFrequency ? { premiumFrequency: query.premiumFrequency } : {},
      premium ? { premium } : {},
      toDateFilter(query) ? { createdAt: toDateFilter(query) } : {},
      query.search
        ? {
            OR: [
              { policyName: containsInsensitive(query.search) },
              { policyCode: containsInsensitive(query.search) },
            ],
          }
        : {},
    ],
  };
  const [total, policies] = await db.$transaction([
    db.policy.count({ where }),
    db.policy.findMany({
      where,
      include: admin
        ? policyInclude
        : { category: policyInclude.category, insurer: policyInclude.insurer },
      orderBy: [{ [query.sortBy]: query.order }, { id: "asc" }],
      ...toSkipTake(query),
    }),
  ]);
  return {
    items: policies.map((policy) => toPolicyDto(policy, admin)),
    meta: buildMeta(query.page, query.limit, total),
  };
}

export async function getPolicy(db: Database, auth: AuthContext, id: string) {
  const admin = isAdmin(auth);
  const policy = await db.policy.findFirst({
    where: { id, ...policyScope(auth) },
    include: admin
      ? policyInclude
      : { category: policyInclude.category, insurer: policyInclude.insurer },
  });
  if (!policy) throw notFound("Policy");
  return toPolicyDto(policy, admin);
}

async function assertCodeAvailable(db: Database, policyCode: string, exceptId?: string) {
  // The database is tenant-scoped, so codes only need to be unique within the tenant.
  const existing = await db.policy.findFirst({ where: { policyCode }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw conflict(`Policy code ${policyCode} is already in use.`);
  }
}

/** The category must belong to this tenant (scoped client) and match the policy's line. */
async function assertCategoryFits(
  db: Database,
  categoryId: string | null | undefined,
  insuranceType: InsuranceType,
  insurerId: string,
) {
  if (!categoryId) return;
  const category = await db.policyCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest("categoryId does not refer to a category in this catalog.");
  if (category.line !== insuranceType) {
    throw badRequest(`That category belongs to the ${category.line} line, not ${insuranceType}.`);
  }
  if (category.insurerId !== insurerId) {
    throw badRequest("That category belongs to a different insurer.");
  }
}

const detailsJson = (details: CategoryDetails | null | undefined) =>
  details ? (details as Prisma.InputJsonValue) : Prisma.DbNull;

export async function createPolicy(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof createPolicyBodySchema>,
) {
  await assertCodeAvailable(db, body.policyCode);
  const tenantId = requireTenantId(requireAuth(request));
  // A policy in a category always belongs to that category's insurer.
  const category = body.categoryId
    ? await db.policyCategory.findUnique({ where: { id: body.categoryId } })
    : null;
  const insurerId = category
    ? category.insurerId
    : await resolveInsurerId(db, tenantId, body.insurerId);
  if (body.insurerId && body.insurerId !== insurerId) {
    throw badRequest("The category belongs to a different insurer.");
  }
  await assertCategoryFits(db, body.categoryId, body.insuranceType, insurerId);
  await assertLineEnabled(db, tenantId, insurerId, body.insuranceType);
  const policy = await db.$transaction(async (tx) => {
    const created = await tx.policy.create({
      data: { ...body, tenantId, insurerId, categoryDetails: detailsJson(body.categoryDetails) },
      include: policyInclude,
    });
    await recordAudit(tx, request, {
      action: "policy.create",
      entity: "Policy",
      entityId: created.id,
      metadata: { policyCode: created.policyCode },
    });
    return created;
  });
  return toPolicyDto(policy, true);
}

/** Adds several policies to one category (or directly to a line) in a single step. */
export async function createPoliciesBulk(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof createPoliciesBulkBodySchema>,
) {
  const tenantId = requireTenantId(requireAuth(request));
  const category = body.categoryId
    ? await db.policyCategory.findUnique({ where: { id: body.categoryId } })
    : null;
  if (body.categoryId && !category) {
    throw badRequest("categoryId does not refer to a category in this catalog.");
  }
  const insurerId = category
    ? category.insurerId
    : await resolveInsurerId(db, tenantId, body.insurerId);
  if (body.insurerId && body.insurerId !== insurerId) {
    throw badRequest("The category belongs to a different insurer.");
  }
  await assertCategoryFits(db, body.categoryId, body.insuranceType, insurerId);
  await assertLineEnabled(db, tenantId, insurerId, body.insuranceType);

  // The same name twice in the list, or one already in this category, is almost certainly a slip.
  const names = body.policies.map((item) => item.policyName.toLowerCase());
  const repeated = names.find((name, index) => names.indexOf(name) !== index);
  if (repeated) throw conflict(`"${repeated}" is listed twice.`);
  const present = await db.policy.findMany({
    where: { tenantId, insurerId, categoryId: body.categoryId ?? null, insuranceType: body.insuranceType },
    select: { policyName: true },
  });
  const clash = present.find((item) => names.includes(item.policyName.toLowerCase()));
  if (clash) throw conflict(`"${clash.policyName}" already exists in this category.`);

  const insurer = await db.insurer.findUniqueOrThrow({
    where: { id: insurerId },
    select: { code: true },
  });
  const used = new Set(
    (await db.policy.findMany({ where: { tenantId }, select: { policyCode: true } })).map(
      (row) => row.policyCode,
    ),
  );
  const prefix = policyCodePrefix(insurer.code);
  const rows = body.policies.map((item) => {
    if (item.policyCode) {
      if (used.has(item.policyCode)) {
        throw conflict(`The policy code ${item.policyCode} is already in use.`);
      }
      used.add(item.policyCode);
    }
    return { ...item, policyCode: item.policyCode ?? makePolicyCode(prefix, item.policyName, used) };
  });

  const created = await db.$transaction(async (tx) => {
    const made = [];
    for (const row of rows) {
      made.push(
        await tx.policy.create({
          data: {
            tenantId,
            insurerId,
            categoryId: body.categoryId ?? null,
            insuranceType: body.insuranceType,
            policyCode: row.policyCode,
            policyName: row.policyName,
            uin: row.uin,
          },
          include: policyInclude,
        }),
      );
    }
    await recordAudit(tx, request, {
      action: "policy.bulk_create",
      entity: "Policy",
      entityId: made[0]!.id,
      metadata: { count: made.length, policyCodes: made.map((policy) => policy.policyCode) },
    });
    return made;
  });
  return { created: created.length, policies: created.map((policy) => toPolicyDto(policy, true)) };
}

export async function updatePolicy(
  db: Database,
  request: FastifyRequest,
  id: string,
  body: z.infer<typeof updatePolicyBodySchema>,
) {
  const existing = await db.policy.findUnique({ where: { id } });
  if (!existing) throw notFound("Policy");
  if (body.policyCode && body.policyCode !== existing.policyCode) {
    await assertCodeAvailable(db, body.policyCode, id);
  }

  // Keep category details consistent with the (possibly new) insurance type.
  const insuranceType = body.insuranceType ?? existing.insuranceType;
  const categoryId = body.categoryId !== undefined ? body.categoryId : existing.categoryId;
  if (body.categoryId !== undefined || body.insuranceType !== undefined) {
    await assertCategoryFits(db, categoryId, insuranceType, existing.insurerId);
  }
  const details =
    body.categoryDetails !== undefined
      ? body.categoryDetails
      : parseDetails(existing.categoryDetails);
  if (details && details.kind !== insuranceType) {
    if (body.categoryDetails) {
      throw badRequest("categoryDetails.kind must match insuranceType.");
    }
  }
  const nextDetails = details && details.kind === insuranceType ? details : null;
  // A policy never moves to another insurer.
  const { categoryDetails: _categoryDetails, insurerId: _insurerId, ...fields } = body;

  const policy = await db.$transaction(async (tx) => {
    const updated = await tx.policy.update({
      where: { id },
      data: { ...fields, categoryDetails: detailsJson(nextDetails) },
      include: policyInclude,
    });
    await recordAudit(tx, request, {
      action: "policy.update",
      entity: "Policy",
      entityId: id,
      metadata: { fields: changedFields(body) },
    });
    return updated;
  });
  return toPolicyDto(policy, true);
}

export async function setPolicyStatus(
  db: Database,
  request: FastifyRequest,
  id: string,
  status: PolicyStatus,
) {
  if (!(await db.policy.findUnique({ where: { id }, select: { id: true } }))) {
    throw notFound("Policy");
  }
  const policy = await db.$transaction(async (tx) => {
    const updated = await tx.policy.update({
      where: { id },
      data: { status },
      include: policyInclude,
    });
    await recordAudit(tx, request, {
      action: "policy.status",
      entity: "Policy",
      entityId: id,
      metadata: { status },
    });
    return updated;
  });
  return toPolicyDto(policy, true);
}

/** Policies that have been sold cannot be deleted; deactivate them instead. */
export async function deletePolicy(db: Database, request: FastifyRequest, id: string) {
  const policy = await db.policy.findUnique({
    where: { id },
    include: { _count: { select: { soldPolicies: true } } },
  });
  if (!policy) throw notFound("Policy");
  if (policy._count.soldPolicies > 0) {
    throw conflict(
      `Policy has been sold ${policy._count.soldPolicies} times and cannot be deleted. Set it INACTIVE instead.`,
    );
  }
  await db.$transaction(async (tx) => {
    await tx.policy.delete({ where: { id } });
    await recordAudit(tx, request, {
      action: "policy.delete",
      entity: "Policy",
      entityId: id,
      metadata: { policyCode: policy.policyCode },
    });
  });
}

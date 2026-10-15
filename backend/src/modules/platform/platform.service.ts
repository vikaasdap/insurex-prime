import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import type { Database } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { InsuranceType, TenantStatus } from "../../generated/prisma/enums.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { buildMeta, toSkipTake } from "../../utils/pagination.js";
import { containsInsensitive } from "../../utils/search.js";
import { changedFields, recordAudit } from "../audit-logs/audit-logs.service.js";
import { revokeUserSessions } from "../auth/agent-session.js";
import { generateTemporaryPassword, hashPassword } from "../auth/password.js";
import { enabledLines, installCatalog } from "../catalog/catalog.service.js";
import { getCatalogTemplate, type CatalogTemplate } from "../catalog/templates/index.js";
import { masterLinesByInsurer, templateForInsurer } from "../catalog/master-catalog.service.js";
import type {
  activateTenantBodySchema,
  createInsurerBodySchema,
  listTenantsQuerySchema,
  tenantInsurerInputSchema,
  updateInsurerBodySchema,
  updateTenantBodySchema,
  updateTenantInsurerBodySchema,
} from "./platform.schemas.js";

const isUniqueViolation = (error: unknown) => (error as { code?: unknown }).code === "P2002";

// ─── Insurers ─────────────────────────────────────────────────────────────────
type InsurerRecord = Prisma.InsurerGetPayload<{
  include: { _count: { select: { tenantLinks: true } } };
}>;

/** Lines the insurer's master catalog covers; an insurer with none yet falls back to a built-in list. */
const templateLinesFor = (insurer: InsurerRecord, masterLines: Map<string, Set<string>>) => {
  const fromMaster = masterLines.get(insurer.id);
  if (fromMaster && fromMaster.size > 0) return [...fromMaster] as InsuranceType[];
  return [...new Set((getCatalogTemplate(insurer.code) ?? []).map((item) => item.line))];
};

const toInsurerDto = (insurer: InsurerRecord, masterLines: Map<string, Set<string>>) => {
  const templateLines = templateLinesFor(insurer, masterLines);
  return {
    id: insurer.id,
    code: insurer.code,
    name: insurer.name,
    active: insurer.active,
    hasCatalogTemplate: templateLines.length > 0,
    templateLines,
    tenants: insurer._count.tenantLinks,
    createdAt: insurer.createdAt.toISOString(),
  };
};

const insurerInclude = { _count: { select: { tenantLinks: true } } } as const;

export async function listInsurers(db: Database) {
  const insurers = await db.insurer.findMany({
    include: insurerInclude,
    orderBy: [{ name: "asc" }],
  });
  const masterLines = await masterLinesByInsurer(db);
  return insurers.map((insurer) => toInsurerDto(insurer, masterLines));
}

export async function createInsurer(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof createInsurerBodySchema>,
) {
  if (await db.insurer.findUnique({ where: { code: body.code }, select: { id: true } })) {
    throw conflict(`Insurer code ${body.code} is already in use.`);
  }
  const insurer = await db.$transaction(async (tx) => {
    const created = await tx.insurer.create({ data: body, include: insurerInclude });
    await recordAudit(tx, request, {
      action: "insurer.create",
      entity: "Insurer",
      entityId: created.id,
      tenantId: null,
      metadata: { code: created.code },
    });
    return created;
  });
  return toInsurerDto(insurer, await masterLinesByInsurer(db));
}

export async function updateInsurer(
  db: Database,
  request: FastifyRequest,
  id: string,
  body: z.infer<typeof updateInsurerBodySchema>,
) {
  if (!(await db.insurer.findUnique({ where: { id }, select: { id: true } }))) {
    throw notFound("Insurer");
  }
  const insurer = await db.$transaction(async (tx) => {
    const updated = await tx.insurer.update({ where: { id }, data: body, include: insurerInclude });
    await recordAudit(tx, request, {
      action: "insurer.update",
      entity: "Insurer",
      entityId: id,
      tenantId: null,
      metadata: { fields: changedFields(body) },
    });
    return updated;
  });
  return toInsurerDto(insurer, await masterLinesByInsurer(db));
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
const tenantInclude = {
  insurers: {
    include: { insurer: { select: { id: true, code: true, name: true } } },
    orderBy: { insurer: { name: "asc" } },
  },
  users: { where: { role: "TENANT_ADMIN" }, select: { email: true }, take: 1 },
  _count: { select: { agents: true, customers: true, policies: true, sold: true } },
} as const satisfies Prisma.TenantInclude;

type TenantRecord = Prisma.TenantGetPayload<{ include: typeof tenantInclude }>;

const toTenantDto = (tenant: TenantRecord, policiesByInsurer: Map<string, number>) => ({
  id: tenant.id,
  name: tenant.name,
  legalName: tenant.legalName,
  logoUrl: tenant.logoUrl,
  contactEmail: tenant.contactEmail,
  contactPhone: tenant.contactPhone,
  insurers: tenant.insurers.map((link) => ({
    insurerId: link.insurerId,
    code: link.insurer.code,
    name: link.insurer.name,
    businessCode: link.businessCode,
    licenceCode: link.licenceCode,
    lines: enabledLines(link),
    policies: policiesByInsurer.get(`${tenant.id}|${link.insurerId}`) ?? 0,
  })),
  status: tenant.status,
  adminEmail: tenant.users[0]?.email ?? null,
  stats: {
    agents: tenant._count.agents,
    customers: tenant._count.customers,
    policies: tenant._count.policies,
    policiesSold: tenant._count.sold,
  },
  activatedAt: tenant.activatedAt.toISOString(),
  createdAt: tenant.createdAt.toISOString(),
  updatedAt: tenant.updatedAt.toISOString(),
});

/** Policy counts per tenant and insurer, for the tenant cards. */
async function countPolicies(db: Database, tenantIds: string[]) {
  const rows = await db.policy.groupBy({
    by: ["tenantId", "insurerId"],
    where: { tenantId: { in: tenantIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [`${row.tenantId}|${row.insurerId}`, row._count._all]));
}

export async function listTenants(db: Database, query: z.infer<typeof listTenantsQuerySchema>) {
  const where: Prisma.TenantWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.insurerId ? { insurers: { some: { insurerId: query.insurerId } } } : {}),
    ...(query.search
      ? {
          OR: [
            { name: containsInsensitive(query.search) },
            { legalName: containsInsensitive(query.search) },
            { insurers: { some: { businessCode: containsInsensitive(query.search) } } },
          ],
        }
      : {}),
  };
  const [total, tenants] = await db.$transaction([
    db.tenant.count({ where }),
    db.tenant.findMany({
      where,
      include: tenantInclude,
      orderBy: [{ [query.sortBy]: query.order }, { id: "asc" }],
      ...toSkipTake(query),
    }),
  ]);
  const counts = await countPolicies(
    db,
    tenants.map((tenant) => tenant.id),
  );
  return {
    items: tenants.map((tenant) => toTenantDto(tenant, counts)),
    meta: buildMeta(query.page, query.limit, total),
  };
}

export async function getTenant(db: Database, id: string) {
  const tenant = await db.tenant.findUnique({ where: { id }, include: tenantInclude });
  if (!tenant) throw notFound("Tenant");
  return toTenantDto(tenant, await countPolicies(db, [id]));
}

type TenantInsurerInput = z.infer<typeof tenantInsurerInputSchema>;

/** Resolves the catalog a new insurer link starts with, reporting what was actually used. */
async function chooseCatalog(
  db: Database,
  insurer: { id: string; code: string },
  input: TenantInsurerInput,
) {
  let source = input.catalog.source;
  let template: CatalogTemplate | undefined;
  if (source === "CUSTOM") {
    if (!input.catalog.lines?.length) {
      throw badRequest("catalog.lines is required when catalog.source is CUSTOM.");
    }
    template = input.catalog.lines;
  } else if (source === "TEMPLATE") {
    template = await templateForInsurer(db, insurer);
    if (!template) source = "NONE"; // no master catalog for this insurer yet: start empty
  }
  // Only the lines the agency sells are installed.
  template = template?.filter((item) => input.lines.includes(item.line));
  return { source, template };
}

async function loadInsurers(db: Database, inputs: TenantInsurerInput[]) {
  const ids = inputs.map((input) => input.insurerId);
  if (new Set(ids).size !== ids.length) throw badRequest("Each insurer can only be listed once.");
  const insurers = await db.insurer.findMany({ where: { id: { in: ids } } });
  return Promise.all(
    inputs.map(async (input) => {
      const insurer = insurers.find((item) => item.id === input.insurerId);
      if (!insurer) throw badRequest("insurerId does not refer to an existing insurer.");
      if (!insurer.active) throw badRequest(`${insurer.name} is not active.`);
      return { input, insurer, ...(await chooseCatalog(db, insurer, input)) };
    }),
  );
}

async function assertBusinessCodesFree(
  db: Database,
  rows: { insurer: { id: string; name: string }; input: TenantInsurerInput }[],
) {
  for (const { insurer, input } of rows) {
    const taken = await db.tenantInsurer.findFirst({
      where: { insurerId: insurer.id, businessCode: input.businessCode },
      select: { id: true },
    });
    if (taken) {
      throw conflict(
        `The business code ${input.businessCode} is already registered to another tenant of ${insurer.name}.`,
      );
    }
  }
}

/**
 * Activates a tenant in one transaction: the tenant, its single admin account (with a
 * temporary password), its insurers with their codes, and each insurer's starting catalog.
 * Nothing is created if any step fails.
 */
export async function activateTenant(
  db: Database,
  request: FastifyRequest,
  body: z.infer<typeof activateTenantBodySchema>,
) {
  const rows = await loadInsurers(db, body.insurers);
  if (await db.user.findUnique({ where: { email: body.adminEmail }, select: { id: true } })) {
    throw conflict("A user with this admin email already exists.");
  }
  await assertBusinessCodesFree(db, rows);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const { tenantId, adminUserId, catalogs } = await db.$transaction(
      async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: body.name, legalName: body.legalName },
        });
        const admin = await tx.user.create({
          data: {
            email: body.adminEmail,
            role: "TENANT_ADMIN",
            tenantId: tenant.id,
            passwordHash,
            mustChangePassword: true,
          },
        });
        const catalogs = [];
        for (const { input, insurer, source, template } of rows) {
          await tx.tenantInsurer.create({
            data: {
              tenantId: tenant.id,
              insurerId: insurer.id,
              businessCode: input.businessCode,
              licenceCode: input.licenceCode,
              lines: input.lines,
            },
          });
          const counts = template
            ? await installCatalog(tx, tenant.id, insurer, template)
            : { categories: 0, policies: 0 };
          catalogs.push({ insurerId: insurer.id, source, ...counts });
        }
        await recordAudit(tx, request, {
          action: "tenant.activate",
          entity: "Tenant",
          entityId: tenant.id,
          tenantId: null,
          metadata: { insurers: rows.map((row) => row.insurer.code) },
        });
        return { tenantId: tenant.id, adminUserId: admin.id, catalogs };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return {
      tenant: await getTenant(db, tenantId),
      admin: { userId: adminUserId, email: body.adminEmail, temporaryPassword },
      catalogs,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("A business code is already registered, or the admin email is taken.");
    }
    throw error;
  }
}

/** Adds another insurer to an existing tenant, optionally loading that insurer's catalog. */
export async function addTenantInsurer(
  db: Database,
  request: FastifyRequest,
  tenantId: string,
  body: TenantInsurerInput,
) {
  if (!(await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
    throw notFound("Tenant");
  }
  const [row] = await loadInsurers(db, [body]);
  if (
    await db.tenantInsurer.findUnique({
      where: { tenantId_insurerId: { tenantId, insurerId: row!.insurer.id } },
      select: { id: true },
    })
  ) {
    throw conflict(`This tenant already sells for ${row!.insurer.name}.`);
  }
  await assertBusinessCodesFree(db, [row!]);

  try {
    const counts = await db.$transaction(
      async (tx) => {
        await tx.tenantInsurer.create({
          data: {
            tenantId,
            insurerId: row!.insurer.id,
            businessCode: body.businessCode,
            licenceCode: body.licenceCode,
            lines: body.lines,
          },
        });
        const installed = row!.template
          ? await installCatalog(tx, tenantId, row!.insurer, row!.template)
          : { categories: 0, policies: 0 };
        await recordAudit(tx, request, {
          action: "tenant.insurer_add",
          entity: "Tenant",
          entityId: tenantId,
          tenantId: null,
          metadata: { insurer: row!.insurer.code, catalog: row!.source },
        });
        return installed;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return { tenant: await getTenant(db, tenantId), catalog: { source: row!.source, ...counts } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("That business code is already registered to another tenant of this insurer.");
    }
    throw error;
  }
}

export async function updateTenantInsurer(
  db: Database,
  request: FastifyRequest,
  tenantId: string,
  insurerId: string,
  body: z.infer<typeof updateTenantInsurerBodySchema>,
) {
  const link = await db.tenantInsurer.findUnique({
    where: { tenantId_insurerId: { tenantId, insurerId } },
    select: { id: true, lines: true },
  });
  if (!link) throw notFound("Tenant insurer");
  if (body.lines) {
    // A line that already has categories or policies cannot be switched off.
    const removed = enabledLines(link).filter((line) => !body.lines!.includes(line));
    for (const line of removed) {
      const [categories, policies] = await Promise.all([
        db.policyCategory.count({ where: { tenantId, insurerId, line } }),
        db.policy.count({ where: { tenantId, insurerId, insuranceType: line } }),
      ]);
      if (categories + policies > 0) {
        throw conflict(
          `${line.toLowerCase()} already has ${categories} categories and ${policies} policies in this catalog; remove them first.`,
        );
      }
    }
  }
  if (body.businessCode) {
    const taken = await db.tenantInsurer.findFirst({
      where: { insurerId, businessCode: body.businessCode, NOT: { id: link.id } },
      select: { id: true },
    });
    if (taken) {
      throw conflict("That business code is already registered to another tenant of this insurer.");
    }
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.tenantInsurer.update({ where: { id: link.id }, data: body });
      await recordAudit(tx, request, {
        action: "tenant.insurer_update",
        entity: "Tenant",
        entityId: tenantId,
        tenantId: null,
        metadata: { insurerId, fields: changedFields(body) },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("That business code is already registered to another tenant of this insurer.");
    }
    throw error;
  }
  return getTenant(db, tenantId);
}

export async function updateTenant(
  db: Database,
  request: FastifyRequest,
  id: string,
  body: z.infer<typeof updateTenantBodySchema>,
) {
  if (!(await db.tenant.findUnique({ where: { id }, select: { id: true } }))) {
    throw notFound("Tenant");
  }
  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: body });
    await recordAudit(tx, request, {
      action: "tenant.update",
      entity: "Tenant",
      entityId: id,
      tenantId: null,
      metadata: { fields: changedFields(body) },
    });
  });
  return getTenant(db, id);
}

/** Suspended tenants cannot sign in: every request re-checks the tenant status. */
export async function setTenantStatus(
  db: Database,
  request: FastifyRequest,
  id: string,
  status: TenantStatus,
) {
  if (!(await db.tenant.findUnique({ where: { id }, select: { id: true } }))) {
    throw notFound("Tenant");
  }
  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id }, data: { status } });
    await recordAudit(tx, request, {
      action: status === "ACTIVE" ? "tenant.reactivate" : "tenant.suspend",
      entity: "Tenant",
      entityId: id,
      tenantId: null,
    });
  });
  return getTenant(db, id);
}

export async function resetTenantAdminPassword(db: Database, request: FastifyRequest, id: string) {
  const admin = await db.user.findFirst({
    where: { tenantId: id, role: "TENANT_ADMIN" },
    select: { id: true, email: true },
  });
  if (!admin) throw notFound("Tenant admin");

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: admin.id },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
    });
    await revokeUserSessions(tx, admin.id);
    await recordAudit(tx, request, {
      action: "tenant.admin_password_reset",
      entity: "Tenant",
      entityId: id,
      tenantId: null,
    });
  });
  return { email: admin.email, temporaryPassword };
}

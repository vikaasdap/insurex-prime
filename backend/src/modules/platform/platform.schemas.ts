import { z } from "zod";
import { InsuranceType, TenantStatus } from "../../generated/prisma/enums.js";
import {
  orderQuerySchema,
  paginationQuerySchema,
  searchQuerySchema,
} from "../../utils/pagination.js";
import { customCatalogSchema } from "../catalog/catalog.schemas.js";

// ─── Insurers ─────────────────────────────────────────────────────────────────
export const insurerSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    active: z.boolean(),
    hasCatalogTemplate: z
      .boolean()
      .describe("A built-in starter catalog exists, so activation can load it"),
    templateLines: z
      .array(z.enum(InsuranceType))
      .describe("Lines of business the built-in starter catalog covers"),
    tenants: z.number().int(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Insurer" });

const insurerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_]{2,30}$/, "use 2–30 capital letters, digits or underscores (e.g. TATA_AIA)");

export const createInsurerBodySchema = z.object({
  code: insurerCode,
  name: z.string().trim().min(2).max(100),
});

export const updateInsurerBodySchema = z
  .object({ name: z.string().trim().min(2).max(100), active: z.boolean() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "at least one field is required");

export const insurerIdParamsSchema = z.object({ id: z.uuid() });

// ─── Tenants ──────────────────────────────────────────────────────────────────
export const tenantInsurerSchema = z
  .object({
    insurerId: z.uuid(),
    code: z.string(),
    name: z.string(),
    businessCode: z.string(),
    licenceCode: z.string(),
    lines: z.array(z.enum(InsuranceType)).describe("Lines of business sold for this insurer"),
    policies: z.number().int().describe("Policies in this tenant's catalog for the insurer"),
  })
  .meta({ id: "TenantInsurer" });

export const tenantSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    legalName: z.string(),
    logoUrl: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    insurers: z.array(tenantInsurerSchema),
    status: z.enum(TenantStatus),
    adminEmail: z.string().nullable(),
    stats: z.object({
      agents: z.number().int(),
      customers: z.number().int(),
      policies: z.number().int(),
      policiesSold: z.number().int(),
    }),
    activatedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Tenant" });

export const tenantIdParamsSchema = z.object({ id: z.uuid() });
export const tenantInsurerParamsSchema = z.object({ id: z.uuid(), insurerId: z.uuid() });

export const listTenantsQuerySchema = paginationQuerySchema
  .extend(searchQuerySchema.shape)
  .extend(orderQuerySchema.shape)
  .extend({
    status: z.enum(TenantStatus).optional(),
    insurerId: z.uuid().optional().describe("Tenants that sell for this insurer"),
    sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  });

const businessCode = z.string().trim().min(2).max(60);

const catalogSourceSchema = z
  .object({
    source: z
      .enum(["TEMPLATE", "CUSTOM", "NONE"])
      .default("TEMPLATE")
      .describe(
        "TEMPLATE loads the built-in catalog for the insurer (if one exists); CUSTOM uses `lines`; NONE starts empty",
      ),
    lines: customCatalogSchema.optional(),
  })
  .default({ source: "TEMPLATE" });

/** One insurer the agency sells for, with the licence codes that insurer issued. */
export const tenantInsurerInputSchema = z.object({
  insurerId: z.uuid().describe("The insurance company"),
  businessCode,
  licenceCode: businessCode.describe("Policy selling licence code issued by the insurer"),
  lines: z
    .array(z.enum(InsuranceType))
    .min(1, "choose at least one line of business")
    .max(4)
    .transform((lines) => [...new Set(lines)])
    .describe("Lines of business the agency sells for this insurer (life, health, motor, commercial)"),
  catalog: catalogSourceSchema,
});

export const activateTenantBodySchema = z.object({
  name: z.string().trim().min(2).max(120).describe("Trading name, e.g. Aakruthi Enterprises"),
  legalName: z.string().trim().min(2).max(200).describe("Registered business name"),
  adminEmail: z
    .email()
    .transform((value) => value.toLowerCase())
    .describe("The tenant's single admin account"),
  insurers: z
    .array(tenantInsurerInputSchema)
    .min(1)
    .max(20)
    .describe("Insurers the agency sells for; each can load its own starting catalog"),
});

/** Small raster logo sent inline; the web app downsizes it before upload. */
export const logoDataUrl = z
  .string()
  .max(300_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, "must be a PNG, JPEG or WebP image");

export const updateTenantBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: z.string().trim().min(2).max(200),
    logoUrl: logoDataUrl.nullable(),
    contactEmail: z.email().max(254).nullable(),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s-]{7,20}$/, "must be a valid phone number")
      .nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "at least one field is required");

export const updateTenantInsurerBodySchema = z
  .object({
    businessCode,
    licenceCode: businessCode,
    lines: z
      .array(z.enum(InsuranceType))
      .min(1, "choose at least one line of business")
      .max(4)
      .transform((lines) => [...new Set(lines)]),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, "at least one field is required");

export const catalogInstalledSchema = z.object({
  source: z.enum(["TEMPLATE", "CUSTOM", "NONE"]),
  categories: z.number().int(),
  policies: z.number().int(),
});

export const tenantActivatedSchema = z
  .object({
    tenant: tenantSchema,
    admin: z.object({
      userId: z.uuid(),
      email: z.string(),
      temporaryPassword: z
        .string()
        .describe("Shown once. The admin must replace it on first sign-in"),
    }),
    catalogs: z.array(catalogInstalledSchema.extend({ insurerId: z.uuid() })),
  })
  .meta({ id: "TenantActivated" });

export const insurerAddedSchema = z
  .object({ tenant: tenantSchema, catalog: catalogInstalledSchema })
  .meta({ id: "TenantInsurerAdded" });

export const adminPasswordSchema = z
  .object({ email: z.string(), temporaryPassword: z.string() })
  .meta({ id: "TenantAdminPassword" });

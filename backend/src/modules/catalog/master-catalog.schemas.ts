import { z } from "zod";
import { InsuranceType } from "../../generated/prisma/enums.js";
import { policyCodeSchema } from "../policies/policies.schemas.js";

const masterPolicySchema = z.object({
  id: z.uuid(),
  policyCode: z.string(),
  policyName: z.string(),
  uin: z.string(),
});

export const masterCatalogSchema = z.array(
  z.object({
    insurer: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
    lines: z.array(
      z.object({
        line: z.enum(InsuranceType),
        categories: z.array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            policies: z.array(masterPolicySchema),
            subCategories: z.array(
              z.object({ id: z.uuid(), name: z.string(), policies: z.array(masterPolicySchema) }),
            ),
          }),
        ),
        policies: z.array(masterPolicySchema).describe("Policies directly under the line"),
      }),
    ),
  }),
);

export const createMasterCategoryBodySchema = z.object({
  insurerId: z.uuid(),
  line: z.enum(InsuranceType),
  parentId: z.uuid().nullable().optional().describe("Set to add a sub-category under a category"),
  name: z.string().trim().min(2).max(120),
});

export const createMasterPoliciesBodySchema = z.object({
  insurerId: z.uuid(),
  insuranceType: z.enum(InsuranceType),
  categoryId: z.uuid().nullable().optional(),
  policies: z
    .array(
      z.object({
        policyName: z.string().trim().min(2).max(120),
        policyCode: z.preprocess(
          (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
          policyCodeSchema.optional(),
        ),
        uin: z.string().trim().max(40).default(""),
      }),
    )
    .min(1)
    .max(50),
});

export const masterIdParamsSchema = z.object({ id: z.uuid() });
export const masterInsurerParamsSchema = z.object({ insurerId: z.uuid() });

export const masterSyncResultSchema = z.object({
  tenants: z.number().int(),
  categoriesAdded: z.number().int(),
  policiesAdded: z.number().int(),
});

import { describe, expect, it } from "vitest";
import { getCatalogTemplate } from "../src/modules/catalog/templates/index.js";
import { enabledLines } from "../src/modules/catalog/catalog.service.js";
import {
  tenantInsurerInputSchema,
  updateTenantInsurerBodySchema,
} from "../src/modules/platform/platform.schemas.js";

const base = {
  insurerId: "6f1f5e0e-5d0e-4f6a-9d57-0b6c1c0d1a11",
  businessCode: "LIC-BC-1",
  licenceCode: "LIC-1",
};

describe("lines of business per tenant insurer", () => {
  it("requires at least one line when adding an insurer", () => {
    expect(tenantInsurerInputSchema.safeParse(base).success).toBe(false);
    expect(tenantInsurerInputSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(tenantInsurerInputSchema.safeParse({ ...base, lines: ["TRAVEL"] }).success).toBe(false);
  });

  it("accepts the ticked lines and drops duplicates", () => {
    const parsed = tenantInsurerInputSchema.parse({ ...base, lines: ["LIFE", "HEALTH", "LIFE"] });
    expect(parsed.lines).toEqual(["LIFE", "HEALTH"]);
  });

  it("lets lines be changed on their own, but never emptied", () => {
    expect(updateTenantInsurerBodySchema.parse({ lines: ["MOTOR"] })).toEqual({ lines: ["MOTOR"] });
    expect(updateTenantInsurerBodySchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it("treats a row from before lines were recorded as selling every line", () => {
    expect(enabledLines({ lines: [] })).toEqual(["LIFE", "HEALTH", "MOTOR", "COMMERCIAL"]);
    expect(enabledLines({ lines: ["LIFE"] })).toEqual(["LIFE"]);
  });

  it("ships a Life catalog for LIC with its main plan sections", () => {
    const template = getCatalogTemplate("LIC");
    expect(template?.map((item) => item.line)).toEqual(["LIFE"]);
    expect(template?.[0]?.categories?.map((category) => category.name)).toEqual([
      "Insurance Plans",
      "Pension Plans",
      "Unit Linked Plans",
      "Health Insurance Plans",
      "Micro Insurance Plans",
      "Withdrawn Plans",
      "GIFT City Plans",
    ]);
  });

  it("groups LIC's Insurance Plans into its five sub-sections", () => {
    const insurance = getCatalogTemplate("LIC")?.[0]?.categories?.[0];
    expect(insurance?.categories?.map((sub) => sub.name)).toEqual([
      "Endowment Plans",
      "Whole Life Plans",
      "Money Back Plans",
      "Term Assurance Plans",
      "Riders",
    ]);
  });

  it("lists LIC's 12 endowment plans with unique codes and UINs", () => {
    const insurance = getCatalogTemplate("LIC")?.[0]?.categories?.find(
      (category) => category.name === "Insurance Plans",
    );
    const endowment = insurance?.categories?.find((sub) => sub.name === "Endowment Plans");
    const plans = endowment?.policies ?? [];
    expect(plans).toHaveLength(12);
    expect(new Set(plans.map((plan) => plan.policyCode)).size).toBe(12);
    expect(new Set(plans.map((plan) => plan.uin)).size).toBe(12);
    expect(plans[2]).toMatchObject({
      name: "New Jeevan Anand",
      policyCode: "LIC-715",
      uin: "512N279V03",
    });
    for (const plan of plans) expect(plan.policyCode).toMatch(/^[A-Z0-9-]{3,30}$/);
  });
});

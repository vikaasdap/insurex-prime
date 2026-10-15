import { describe, expect, it } from "vitest";
import { createPoliciesBulkBodySchema } from "../src/modules/policies/policies.schemas.js";

const category = "6f1f5e0e-5d0e-4f6a-9d57-0b6c1c0d1a11";

describe("adding several policies at once", () => {
  it("takes a name, optional code and optional UIN per row", () => {
    const parsed = createPoliciesBulkBodySchema.parse({
      insuranceType: "LIFE",
      categoryId: category,
      policies: [
        { policyName: "Jeevan Anand", policyCode: " lic-914 ", uin: " 512N277V02 " },
        { policyName: "Jeevan Utsav", policyCode: "", uin: "" },
        { policyName: "Bima Jyoti" },
      ],
    });
    expect(parsed.policies[0]).toEqual({
      policyName: "Jeevan Anand",
      policyCode: "LIC-914",
      uin: "512N277V02",
    });
    // A blank code is left for the server to generate from the name.
    expect(parsed.policies[1]?.policyCode).toBeUndefined();
    expect(parsed.policies[2]).toMatchObject({ policyName: "Bima Jyoti", uin: "" });
  });

  it("rejects an empty list, a too-short name and a malformed code", () => {
    const bad = (policies: unknown[]) =>
      createPoliciesBulkBodySchema.safeParse({ insuranceType: "LIFE", policies }).success;
    expect(bad([])).toBe(false);
    expect(bad([{ policyName: "A" }])).toBe(false);
    expect(bad([{ policyName: "Jeevan Anand", policyCode: "x y" }])).toBe(false);
    expect(bad([{ policyName: "Jeevan Anand" }])).toBe(true);
  });
});

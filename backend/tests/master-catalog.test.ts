import { describe, expect, it } from "vitest";
import { loadMasterTemplate } from "../src/modules/catalog/master-catalog.service.js";

/** A reader that returns fixed rows, standing in for the database. */
const reader = (categories: object[], policies: object[]) =>
  ({
    masterCategory: { findMany: async () => categories },
    masterPolicy: { findMany: async () => policies },
  }) as unknown as Parameters<typeof loadMasterTemplate>[0];

const policy = (over: object) => ({
  description: "",
  coverageAmount: null,
  premium: null,
  durationMonths: null,
  benefits: [],
  categoryDetails: null,
  uin: "",
  ...over,
});

describe("master catalog → tenant template", () => {
  it("is null while an insurer has no master entries", async () => {
    expect(await loadMasterTemplate(reader([], []), "i1")).toBeNull();
  });

  it("nests sub-categories and keeps codes and UINs", async () => {
    const template = await loadMasterTemplate(
      reader(
        [
          { id: "c1", line: "LIFE", parentId: null, name: "Insurance Plans", sortOrder: 0 },
          { id: "c2", line: "LIFE", parentId: "c1", name: "Endowment Plans", sortOrder: 0 },
        ],
        [
          policy({
            id: "p1",
            categoryId: "c2",
            insuranceType: "LIFE",
            policyCode: "LIC-715",
            policyName: "New Jeevan Anand",
            uin: "512N279V03",
          }),
          policy({
            id: "p2",
            categoryId: null,
            insuranceType: "HEALTH",
            policyCode: "H-1",
            policyName: "Direct health plan",
          }),
        ],
      ),
      "i1",
    );
    expect(template?.map((item) => item.line)).toEqual(["LIFE", "HEALTH"]);
    const life = template![0]!;
    expect(life.categories?.[0]?.name).toBe("Insurance Plans");
    expect(life.categories?.[0]?.categories?.[0]).toMatchObject({
      name: "Endowment Plans",
      policies: [{ name: "New Jeevan Anand", policyCode: "LIC-715", uin: "512N279V03" }],
    });
    expect(template![1]?.policies?.[0]?.name).toBe("Direct health plan");
  });
});

import type { CategoryDetails } from "../../policies/policies.schemas.js";
import type { CatalogTemplate } from "./types.js";

const floater = (sumInsured: number): CategoryDetails => ({
  kind: "HEALTH",
  planType: "FAMILY",
  sumInsured,
  hospitalizationCoverage: "",
  waitingPeriod: "",
  ageEligibility: "",
});

const motor = (vehicleType: "PRIVATE_CAR" | "TWO_WHEELER"): CategoryDetails => ({
  kind: "MOTOR",
  vehicleType,
  coverageType: "COMPREHENSIVE",
  ownDamage: "",
  thirdPartyCoverage: "",
  vehicleEligibility: "",
});

/**
 * TATA AIG health plans (the MediCare range), split the way the insurer's portal filters
 * them: Indemnity and Deductible. Premiums on the portal depend on the insured's age and
 * city, so they are mentioned only as an indicative figure in the description; the real
 * premium is entered when a sale is recorded.
 */
export const tataAigTemplate: CatalogTemplate = [
  {
    line: "HEALTH",
    categories: [
      {
        name: "Indemnity",
        policies: [
          {
            name: "MediCare Select – SMART",
            description: "Floater plan. Indicative annual premium ₹7,289 for ₹5 Lakh sum insured.",
            coverageAmount: 500_000,
            durationMonths: 12,
            categoryDetails: floater(500_000),
            benefits: [
              "Affordable comprehensive protection with flexible coverage options",
              "Twin Sharing accommodation",
              "Save more with NRI Discount (where applicable)",
            ],
          },
          {
            name: "MediCare Select",
            description: "Floater plan. Indicative annual premium ₹8,889 for ₹5 Lakh sum insured.",
            coverageAmount: 500_000,
            durationMonths: 12,
            categoryDetails: floater(500_000),
            benefits: [
              "Unlimited times restoration of sum insured in a policy year",
              "Single private room accommodation",
              "No sum insured limit applicable for one claim",
            ],
          },
          {
            name: "MediCare Plus",
            description: "Floater plan. Indicative annual premium ₹4,036 for ₹5 Lakh sum insured.",
            coverageAmount: 500_000,
            durationMonths: 12,
            categoryDetails: floater(500_000),
            benefits: ["No Room Category Capping", "Health Checkup & Consumables Benefit"],
          },
        ],
      },
      {
        name: "Deductible",
        policies: [
          {
            name: "MediCare Reserve",
            description:
              "Floater plan with a ₹3 Lakh deductible. Indicative annual premium ₹3,069 for ₹5 Lakh sum insured.",
            coverageAmount: 500_000,
            durationMonths: 12,
            categoryDetails: floater(500_000),
            benefits: [
              "Option to convert to zero Deductible after 5 years, no fresh underwriting required",
              "Continuity of Waiver of Aggregate Deductible to newly added members",
            ],
          },
        ],
      },
    ],
  },
  {
    line: "MOTOR",
    policies: [
      {
        name: "Two Wheeler",
        description: "Two wheeler insurance. The premium is entered when a sale is recorded.",
        durationMonths: 12,
        categoryDetails: motor("TWO_WHEELER"),
      },
      {
        name: "Four Wheeler",
        description: "Four wheeler (private car) insurance. The premium is entered when a sale is recorded.",
        durationMonths: 12,
        categoryDetails: motor("PRIVATE_CAR"),
      },
    ],
  },
];

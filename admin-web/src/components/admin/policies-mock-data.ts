import { formatINR } from "./admin-mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────
// Policy products are the catalog the Super Admin manages. Agent policy selection,
// sold policies, customer policy details, receipts and reports should all reference
// products through this model (by `id`, displaying `code` / `name`).
export type PolicyInsuranceType = "Health" | "Motor" | "Life" | "Commercial";
export type PolicyProductStatus = "Active" | "Inactive";
export type PremiumFrequency = "Monthly" | "Quarterly" | "Half-Yearly" | "Annual";

export interface HealthPolicyDetails {
  planType: "Individual" | "Family";
  sumInsured: number;
  hospitalizationCoverage: string;
  waitingPeriod: string;
  ageEligibility: string;
}

export type VehicleType = "Private Car" | "Two Wheeler" | "Commercial Vehicle";
export type MotorCoverageType = "Third Party" | "Comprehensive" | "Own Damage";

export interface MotorPolicyDetails {
  vehicleType: VehicleType;
  coverageType: MotorCoverageType;
  ownDamage: string;
  thirdPartyCoverage: string;
  vehicleEligibility: string;
}

interface PolicyProductBase {
  id: string; // stable internal id, "PRD-001"
  code: string; // admin-facing policy code, editable
  name: string;
  description: string;
  coverageAmount: number;
  premium: number;
  premiumFrequency: PremiumFrequency;
  durationMonths: number;
  eligibility: string;
  benefits: string[]; // key benefits
  terms: string;
  status: PolicyProductStatus;
  policiesSold: number;
  lastUpdated: string; // ISO "YYYY-MM-DD"
}

export type PolicyProduct = PolicyProductBase &
  (
    | { type: "Health"; health: HealthPolicyDetails; motor?: never }
    | { type: "Motor"; motor: MotorPolicyDetails; health?: never }
    // Life and commercial products carry no line-specific detail block.
    | { type: "Life" | "Commercial"; health?: never; motor?: never }
  );

// ─── Options ──────────────────────────────────────────────────────────────────
export const premiumFrequencies: PremiumFrequency[] = [
  "Monthly",
  "Quarterly",
  "Half-Yearly",
  "Annual",
];
export const policyDurationOptions = [12, 24, 36, 60];
export const vehicleTypes: VehicleType[] = ["Private Car", "Two Wheeler", "Commercial Vehicle"];
export const motorCoverageTypes: MotorCoverageType[] = [
  "Third Party",
  "Comprehensive",
  "Own Damage",
];

export interface PremiumRange {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const premiumRanges: PremiumRange[] = [
  { id: "all", label: "Premium: Any", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "lt10k", label: "Under ₹10,000", min: 0, max: 9_999 },
  { id: "10k-25k", label: "₹10,000 – ₹25,000", min: 10_000, max: 25_000 },
  { id: "gt25k", label: "Above ₹25,000", min: 25_001, max: Number.POSITIVE_INFINITY },
];

export const policyTypeColors: Record<PolicyInsuranceType, string> = {
  Health: "#2563eb", // matches dashboard policy distribution
  Motor: "#059669",
  Life: "#f59e0b",
  Commercial: "#8b5cf6",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const formatPolicyDuration = (months: number): string => {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${months} months`;
};

const standardHealthTerms =
  "Pre-existing diseases covered after the waiting period. Claims are subject to policy wording and network hospital rules.";
const standardMotorTerms =
  "Cover is valid only with a valid RC and driving licence. Claims are subject to survey and policy wording.";

// ─── 24 Demo Policy Products ──────────────────────────────────────────────────
export const policyProductsList: PolicyProduct[] = [
  {
    id: "PRD-001",
    code: "HLT-BAS-001",
    name: "Health Basic",
    type: "Health",
    description: "Entry-level individual health cover for hospitalization and day-care costs.",
    coverageAmount: 300_000,
    premium: 6_499,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–55 with no major pre-existing conditions.",
    benefits: ["Cashless at 8,000+ network hospitals", "Day-care procedures", "Ambulance cover"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 412,
    lastUpdated: "2026-09-24",
    health: {
      planType: "Individual",
      sumInsured: 300_000,
      hospitalizationCoverage: "Room rent up to 1% of sum insured per day",
      waitingPeriod: "30 days initial, 3 years for pre-existing diseases",
      ageEligibility: "18–55 years",
    },
  },
  {
    id: "PRD-002",
    code: "HLT-PRM-002",
    name: "Health Premium",
    type: "Health",
    description: "Comprehensive individual cover with higher room limits and OPD benefits.",
    coverageAmount: 1_000_000,
    premium: 14_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–65.",
    benefits: ["No room rent capping", "OPD cover up to ₹10,000", "Annual health check-up"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 286,
    lastUpdated: "2026-09-22",
    health: {
      planType: "Individual",
      sumInsured: 1_000_000,
      hospitalizationCoverage: "Single private room, no capping",
      waitingPeriod: "30 days initial, 2 years for pre-existing diseases",
      ageEligibility: "18–65 years",
    },
  },
  {
    id: "PRD-003",
    code: "HLT-GLD-003",
    name: "Health Gold",
    type: "Health",
    description: "High sum insured plan with global second opinion and restoration benefit.",
    coverageAmount: 2_500_000,
    premium: 24_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–65.",
    benefits: [
      "100% sum insured restoration",
      "Global second opinion",
      "No-claim bonus up to 100%",
    ],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 158,
    lastUpdated: "2026-09-18",
    health: {
      planType: "Individual",
      sumInsured: 2_500_000,
      hospitalizationCoverage: "Any room category",
      waitingPeriod: "30 days initial, 2 years for pre-existing diseases",
      ageEligibility: "18–65 years",
    },
  },
  {
    id: "PRD-004",
    code: "HLT-FAM-004",
    name: "Family Health Plus",
    type: "Health",
    description: "Family floater covering self, spouse and up to three dependent children.",
    coverageAmount: 1_500_000,
    premium: 28_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Families with adults aged 18–60 and children from 91 days to 25 years.",
    benefits: ["Single floater sum insured", "Newborn cover from day one", "Maternity add-on"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 341,
    lastUpdated: "2026-09-25",
    health: {
      planType: "Family",
      sumInsured: 1_500_000,
      hospitalizationCoverage: "Single private room",
      waitingPeriod: "30 days initial, 3 years for pre-existing diseases",
      ageEligibility: "Adults 18–60, children 91 days–25 years",
    },
  },
  {
    id: "PRD-005",
    code: "HLT-SNR-005",
    name: "Senior Care Shield",
    type: "Health",
    description: "Health cover designed for senior citizens with domiciliary treatment.",
    coverageAmount: 500_000,
    premium: 21_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Senior citizens aged 60–80; pre-policy medical check required.",
    benefits: ["Domiciliary hospitalization", "AYUSH treatment", "Lifelong renewability"],
    terms: `${standardHealthTerms} 20% co-payment applies on all claims.`,
    status: "Active",
    policiesSold: 97,
    lastUpdated: "2026-09-12",
    health: {
      planType: "Individual",
      sumInsured: 500_000,
      hospitalizationCoverage: "Room rent up to ₹5,000 per day",
      waitingPeriod: "30 days initial, 1 year for pre-existing diseases",
      ageEligibility: "60–80 years",
    },
  },
  {
    id: "PRD-006",
    code: "HLT-FAM-006",
    name: "Family Floater Essential",
    type: "Health",
    description: "Affordable family floater for young families.",
    coverageAmount: 500_000,
    premium: 15_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Families with adults aged 18–50.",
    benefits: ["Covers up to 4 members", "Day-care procedures", "Pre & post hospitalization"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 223,
    lastUpdated: "2026-09-10",
    health: {
      planType: "Family",
      sumInsured: 500_000,
      hospitalizationCoverage: "Room rent up to 1% of sum insured per day",
      waitingPeriod: "30 days initial, 3 years for pre-existing diseases",
      ageEligibility: "Adults 18–50, children 91 days–25 years",
    },
  },
  {
    id: "PRD-007",
    code: "HLT-CRT-007",
    name: "Critical Illness Cover",
    type: "Health",
    description: "Lump-sum payout on diagnosis of 32 listed critical illnesses.",
    coverageAmount: 2_000_000,
    premium: 8_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–60.",
    benefits: ["Lump-sum payout", "Covers 32 critical illnesses", "Tax benefit under 80D"],
    terms: "90-day waiting period and 30-day survival period apply.",
    status: "Active",
    policiesSold: 64,
    lastUpdated: "2026-08-30",
    health: {
      planType: "Individual",
      sumInsured: 2_000_000,
      hospitalizationCoverage: "Not applicable — benefit-based payout",
      waitingPeriod: "90 days",
      ageEligibility: "18–60 years",
    },
  },
  {
    id: "PRD-008",
    code: "HLT-MAT-008",
    name: "Maternity Care Plus",
    type: "Health",
    description: "Family plan with maternity, newborn and vaccination benefits.",
    coverageAmount: 700_000,
    premium: 18_499,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Couples aged 21–45.",
    benefits: ["Maternity up to ₹75,000", "Newborn vaccination", "Pre-natal consultations"],
    terms: `${standardHealthTerms} Maternity benefits after 2 years.`,
    status: "Inactive",
    policiesSold: 41,
    lastUpdated: "2026-07-14",
    health: {
      planType: "Family",
      sumInsured: 700_000,
      hospitalizationCoverage: "Single private room",
      waitingPeriod: "2 years for maternity",
      ageEligibility: "21–45 years",
    },
  },
  {
    id: "PRD-009",
    code: "HLT-TOP-009",
    name: "Super Top-Up Health",
    type: "Health",
    description: "Top-up cover that pays above a deductible across the policy year.",
    coverageAmount: 5_000_000,
    premium: 4_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–65; ₹3,00,000 deductible.",
    benefits: ["Aggregate deductible", "Works with any base policy", "Low premium"],
    terms: "Claims payable only after the aggregate deductible is exhausted.",
    status: "Active",
    policiesSold: 119,
    lastUpdated: "2026-09-05",
    health: {
      planType: "Individual",
      sumInsured: 5_000_000,
      hospitalizationCoverage: "Any room category above deductible",
      waitingPeriod: "30 days initial",
      ageEligibility: "18–65 years",
    },
  },
  {
    id: "PRD-010",
    code: "HLT-MON-010",
    name: "Health Basic Monthly",
    type: "Health",
    description: "Health Basic coverage with a monthly premium option.",
    coverageAmount: 300_000,
    premium: 599,
    premiumFrequency: "Monthly",
    durationMonths: 12,
    eligibility: "Individuals aged 18–45 with auto-debit mandate.",
    benefits: ["Monthly payments", "Cashless hospitalization", "Day-care procedures"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 182,
    lastUpdated: "2026-09-20",
    health: {
      planType: "Individual",
      sumInsured: 300_000,
      hospitalizationCoverage: "Room rent up to 1% of sum insured per day",
      waitingPeriod: "30 days initial, 3 years for pre-existing diseases",
      ageEligibility: "18–45 years",
    },
  },
  {
    id: "PRD-011",
    code: "HLT-PLT-011",
    name: "Health Platinum",
    type: "Health",
    description: "Top-tier individual cover with international treatment option.",
    coverageAmount: 5_000_000,
    premium: 42_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–65.",
    benefits: ["International treatment", "Air ambulance", "Unlimited restoration"],
    terms: standardHealthTerms,
    status: "Active",
    policiesSold: 52,
    lastUpdated: "2026-09-01",
    health: {
      planType: "Individual",
      sumInsured: 5_000_000,
      hospitalizationCoverage: "Any room category, worldwide",
      waitingPeriod: "30 days initial, 1 year for pre-existing diseases",
      ageEligibility: "18–65 years",
    },
  },
  {
    id: "PRD-012",
    code: "HLT-YNG-012",
    name: "Young Adult Health",
    type: "Health",
    description: "Low-premium cover for first-time policyholders.",
    coverageAmount: 300_000,
    premium: 4_299,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Individuals aged 18–30.",
    benefits: ["Low premium", "Fitness rewards", "Teleconsultation"],
    terms: standardHealthTerms,
    status: "Inactive",
    policiesSold: 133,
    lastUpdated: "2026-06-28",
    health: {
      planType: "Individual",
      sumInsured: 300_000,
      hospitalizationCoverage: "Room rent up to 1% of sum insured per day",
      waitingPeriod: "30 days initial, 3 years for pre-existing diseases",
      ageEligibility: "18–30 years",
    },
  },
  {
    id: "PRD-013",
    code: "MTR-CBS-001",
    name: "Car Basic",
    type: "Motor",
    description: "Mandatory third-party liability cover for private cars.",
    coverageAmount: 750_000,
    premium: 3_416,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Private cars of any age with valid registration.",
    benefits: [
      "Third-party injury & death cover",
      "Property damage up to ₹7.5 lakh",
      "PA cover for owner-driver",
    ],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 389,
    lastUpdated: "2026-09-23",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Third Party",
      ownDamage: "Not covered",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Any private car with valid RC",
    },
  },
  {
    id: "PRD-014",
    code: "MTR-CCM-002",
    name: "Car Comprehensive",
    type: "Motor",
    description: "Own damage plus third-party cover for private cars.",
    coverageAmount: 800_000,
    premium: 12_499,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Private cars up to 10 years old.",
    benefits: ["Own damage cover", "Theft & fire", "Cashless garages"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 305,
    lastUpdated: "2026-09-21",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹8,00,000",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Private cars up to 10 years old",
    },
  },
  {
    id: "PRD-015",
    code: "MTR-CPR-003",
    name: "Car Premium",
    type: "Motor",
    description: "Comprehensive cover with zero depreciation and engine protection.",
    coverageAmount: 1_500_000,
    premium: 21_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Private cars up to 5 years old.",
    benefits: ["Zero depreciation", "Engine protect", "24×7 roadside assistance"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 172,
    lastUpdated: "2026-09-19",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹15,00,000 with zero depreciation",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Private cars up to 5 years old",
    },
  },
  {
    id: "PRD-016",
    code: "MTR-SEC-004",
    name: "Motor Secure",
    type: "Motor",
    description: "Comprehensive car cover with return-to-invoice and consumables.",
    coverageAmount: 1_000_000,
    premium: 17_499,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Private cars up to 3 years old.",
    benefits: ["Return to invoice", "Consumables cover", "Key replacement"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 214,
    lastUpdated: "2026-09-16",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Comprehensive",
      ownDamage: "Up to invoice value of ₹10,00,000",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Private cars up to 3 years old",
    },
  },
  {
    id: "PRD-017",
    code: "MTR-TWB-005",
    name: "Two Wheeler Basic",
    type: "Motor",
    description: "Third-party liability cover for scooters and motorcycles.",
    coverageAmount: 100_000,
    premium: 714,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Two-wheelers of any age with valid registration.",
    benefits: ["Third-party liability", "PA cover for owner-rider", "Instant policy issuance"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 268,
    lastUpdated: "2026-09-14",
    motor: {
      vehicleType: "Two Wheeler",
      coverageType: "Third Party",
      ownDamage: "Not covered",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹1,00,000",
      vehicleEligibility: "Any two-wheeler with valid RC",
    },
  },
  {
    id: "PRD-018",
    code: "MTR-TWC-006",
    name: "Two Wheeler Comprehensive",
    type: "Motor",
    description: "Own damage and third-party cover for two-wheelers.",
    coverageAmount: 120_000,
    premium: 2_199,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Two-wheelers up to 8 years old.",
    benefits: ["Own damage cover", "Theft cover", "Roadside assistance"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 149,
    lastUpdated: "2026-09-08",
    motor: {
      vehicleType: "Two Wheeler",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹1,20,000",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹1,00,000",
      vehicleEligibility: "Two-wheelers up to 8 years old",
    },
  },
  {
    id: "PRD-019",
    code: "MTR-COD-007",
    name: "Car Own Damage Only",
    type: "Motor",
    description: "Standalone own damage cover for cars with an active third-party policy.",
    coverageAmount: 900_000,
    premium: 9_499,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Private cars with an active long-term third-party policy.",
    benefits: ["Own damage cover", "NCB protection", "Cashless garages"],
    terms: `${standardMotorTerms} Valid third-party policy mandatory.`,
    status: "Active",
    policiesSold: 88,
    lastUpdated: "2026-08-27",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Own Damage",
      ownDamage: "Up to IDV of ₹9,00,000",
      thirdPartyCoverage: "Not covered — separate TP policy required",
      vehicleEligibility: "Private cars with active TP policy",
    },
  },
  {
    id: "PRD-020",
    code: "MTR-EVP-008",
    name: "EV Car Protect",
    type: "Motor",
    description: "Comprehensive cover for electric cars including battery protection.",
    coverageAmount: 2_000_000,
    premium: 24_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Electric private cars up to 5 years old.",
    benefits: ["Battery & charger cover", "Zero depreciation", "EV roadside assistance"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 47,
    lastUpdated: "2026-09-26",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹20,00,000 incl. battery pack",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Electric private cars up to 5 years old",
    },
  },
  {
    id: "PRD-021",
    code: "MTR-CMV-009",
    name: "Commercial Vehicle Shield",
    type: "Motor",
    description: "Comprehensive cover for goods-carrying commercial vehicles.",
    coverageAmount: 2_500_000,
    premium: 38_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Goods carriers up to 12 tonnes GVW, up to 10 years old.",
    benefits: ["Own damage cover", "Driver & cleaner PA", "Legal liability to employees"],
    terms: `${standardMotorTerms} Valid permit and fitness certificate required.`,
    status: "Active",
    policiesSold: 58,
    lastUpdated: "2026-09-03",
    motor: {
      vehicleType: "Commercial Vehicle",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹25,00,000",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Goods carriers up to 12 tonnes GVW",
    },
  },
  {
    id: "PRD-022",
    code: "MTR-TXI-010",
    name: "Taxi Fleet Cover",
    type: "Motor",
    description: "Comprehensive cover for passenger-carrying taxis and cabs.",
    coverageAmount: 900_000,
    premium: 19_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Commercial taxis up to 7 years old.",
    benefits: ["Passenger liability", "Own damage cover", "Fleet discount"],
    terms: `${standardMotorTerms} Valid taxi permit required.`,
    status: "Inactive",
    policiesSold: 36,
    lastUpdated: "2026-07-02",
    motor: {
      vehicleType: "Commercial Vehicle",
      coverageType: "Comprehensive",
      ownDamage: "Up to IDV of ₹9,00,000",
      thirdPartyCoverage: "Unlimited injury/death incl. passengers",
      vehicleEligibility: "Commercial taxis up to 7 years old",
    },
  },
  {
    id: "PRD-023",
    code: "MTR-LTP-011",
    name: "Car Long-Term Third Party",
    type: "Motor",
    description: "Three-year third-party cover for new private cars.",
    coverageAmount: 750_000,
    premium: 10_640,
    premiumFrequency: "Annual",
    durationMonths: 36,
    eligibility: "New private cars at first registration.",
    benefits: ["3-year mandatory TP cover", "Single upfront payment", "PA cover for owner-driver"],
    terms: standardMotorTerms,
    status: "Active",
    policiesSold: 121,
    lastUpdated: "2026-08-21",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Third Party",
      ownDamage: "Not covered",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "New private cars only",
    },
  },
  {
    id: "PRD-024",
    code: "MTR-CLS-012",
    name: "Classic Car Cover",
    type: "Motor",
    description: "Agreed-value cover for vintage and classic cars.",
    coverageAmount: 3_000_000,
    premium: 34_999,
    premiumFrequency: "Annual",
    durationMonths: 12,
    eligibility: "Cars over 25 years old, certified by a vintage car club.",
    benefits: ["Agreed value cover", "Specialist repairer network", "Rally & exhibition cover"],
    terms: `${standardMotorTerms} Annual mileage capped at 5,000 km.`,
    status: "Inactive",
    policiesSold: 12,
    lastUpdated: "2026-05-30",
    motor: {
      vehicleType: "Private Car",
      coverageType: "Comprehensive",
      ownDamage: "Agreed value up to ₹30,00,000",
      thirdPartyCoverage: "Unlimited injury/death; property up to ₹7,50,000",
      vehicleEligibility: "Certified vintage cars over 25 years old",
    },
  },
];

export { formatINR };

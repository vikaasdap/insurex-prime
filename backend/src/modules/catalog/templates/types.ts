import type { InsuranceType } from "../../../generated/prisma/enums.js";
import type { CategoryDetails } from "../../policies/policies.schemas.js";

/** A policy name in a catalog. Price, cover and term are optional: they are quoted on the insurer's portal. */
export interface PolicyTemplate {
  name: string;
  /** Used as the policy code when given; otherwise one is made from the name. */
  policyCode?: string;
  /** The insurer's Unique Identification Number. */
  uin?: string;
  description?: string;
  coverageAmount?: number;
  premium?: number;
  durationMonths?: number;
  benefits?: string[];
  categoryDetails?: CategoryDetails;
}

/** A category or sub-category. The catalog allows two levels: category → sub-category. */
export interface CategoryTemplate {
  name: string;
  categories?: CategoryTemplate[];
  policies?: PolicyTemplate[];
}

export interface LineTemplate {
  line: InsuranceType;
  /** Policies that sit directly under the line (e.g. a motor product with no categories). */
  policies?: PolicyTemplate[];
  categories?: CategoryTemplate[];
}

export type CatalogTemplate = LineTemplate[];

/** Maps a list of names to policy templates. */
export const names = (...policyNames: string[]): PolicyTemplate[] =>
  policyNames.map((name) => ({ name }));

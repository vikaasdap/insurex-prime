import { apiRequest } from "./client";
import type { InsuranceType } from "./types";

export interface MasterPolicy {
  id: string;
  policyCode: string;
  policyName: string;
  uin: string;
}

export interface MasterSubCategory {
  id: string;
  name: string;
  policies: MasterPolicy[];
}

export interface MasterCategory extends MasterSubCategory {
  subCategories: MasterSubCategory[];
}

export interface MasterLine {
  line: InsuranceType;
  categories: MasterCategory[];
  /** Policies directly under the line (no category). */
  policies: MasterPolicy[];
}

export interface MasterInsurer {
  insurer: { id: string; code: string; name: string };
  lines: MasterLine[];
}

export interface MasterSyncResult {
  tenants: number;
  categoriesAdded: number;
  policiesAdded: number;
}

export const masterCatalogKeys = { all: ["platform", "master-catalog"] as const };

/** The platform owner's catalog of every insurer; new agencies start from it. */
export const masterCatalogApi = {
  list: () => apiRequest<MasterInsurer[]>("/platform/catalog"),
  createCategory: (body: {
    insurerId: string;
    line: InsuranceType;
    parentId?: string | null;
    name: string;
  }) =>
    apiRequest<{ id: string; name: string }>("/platform/catalog/categories", {
      method: "POST",
      body,
    }),
  createPolicies: (body: {
    insurerId: string;
    insuranceType: InsuranceType;
    categoryId: string | null;
    policies: { policyName: string; policyCode?: string; uin?: string }[];
  }) => apiRequest<{ created: number }>("/platform/catalog/policies", { method: "POST", body }),
  removeCategory: (id: string) =>
    apiRequest<{ id: string }>(`/platform/catalog/categories/${id}`, { method: "DELETE" }),
  removePolicy: (id: string) =>
    apiRequest<{ id: string }>(`/platform/catalog/policies/${id}`, { method: "DELETE" }),
  syncTenants: (insurerId: string) =>
    apiRequest<MasterSyncResult>(`/platform/catalog/${insurerId}/sync-tenants`, {
      method: "POST",
    }),
};

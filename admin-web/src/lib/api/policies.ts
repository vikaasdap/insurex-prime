import { apiRequest, apiRequestPaginated, toQuery, type ListParams } from "./client";
import type {
  ApiPolicy,
  InsuranceType,
  PolicyInput,
  PolicyStatus,
  PremiumFrequency,
} from "./types";

export interface PolicyListParams extends ListParams {
  insuranceType?: InsuranceType | undefined;
  categoryId?: string | undefined;
  status?: PolicyStatus | undefined;
  premiumFrequency?: PremiumFrequency | undefined;
  premiumMin?: number | undefined;
  premiumMax?: number | undefined;
}

/** One row of the "add policies" popup. */
export interface BulkPolicyRow {
  policyName: string;
  /** Left blank, it is made from the name. */
  policyCode?: string;
  uin?: string;
}

export interface BulkPoliciesInput {
  insuranceType: InsuranceType;
  insurerId: string;
  /** Null adds the policies directly under the line (no category). */
  categoryId: string | null;
  policies: BulkPolicyRow[];
}

/** Agents receive ACTIVE policies only and cannot change the catalog. */
export const policiesApi = {
  list: (params?: PolicyListParams) =>
    apiRequestPaginated<ApiPolicy>("/policies", { query: toQuery(params) }),
  get: (id: string) => apiRequest<ApiPolicy>(`/policies/${id}`),
  create: (input: PolicyInput) =>
    apiRequest<ApiPolicy>("/policies", { method: "POST", body: input }),
  createMany: (input: BulkPoliciesInput) =>
    apiRequest<{ created: number; policies: ApiPolicy[] }>("/policies/bulk", {
      method: "POST",
      body: input,
    }),
  update: (id: string, input: Partial<PolicyInput>) =>
    apiRequest<ApiPolicy>(`/policies/${id}`, { method: "PATCH", body: input }),
  setStatus: (id: string, status: PolicyStatus) =>
    apiRequest<ApiPolicy>(`/policies/${id}/status`, { method: "PATCH", body: { status } }),
  remove: (id: string) => apiRequest<{ id: string }>(`/policies/${id}`, { method: "DELETE" }),
};

import { apiRequest, apiRequestPaginated, toQuery, type ListParams } from "./client";
import type { InsuranceType } from "./types";

export interface ApiInsurer {
  id: string;
  code: string;
  name: string;
  active: boolean;
  hasCatalogTemplate: boolean;
  /** Lines of business the built-in starter catalog covers. */
  templateLines: InsuranceType[];
  tenants: number;
}

export interface ApiTenantInsurer {
  insurerId: string;
  code: string;
  name: string;
  businessCode: string;
  licenceCode: string;
  /** Lines of business the agency sells for this insurer. */
  lines: InsuranceType[];
  /** Policies in this tenant's catalog for the insurer. */
  policies: number;
}

export interface ApiTenant {
  id: string;
  name: string;
  legalName: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  insurers: ApiTenantInsurer[];
  status: "ACTIVE" | "SUSPENDED";
  adminEmail: string | null;
  stats: { agents: number; customers: number; policies: number; policiesSold: number };
  activatedAt: string;
}

export interface TenantInsurerInput {
  insurerId: string;
  businessCode: string;
  licenceCode: string;
  lines: InsuranceType[];
  catalog: { source: "TEMPLATE" | "NONE" };
}

export interface ActivateTenantInput {
  name: string;
  legalName: string;
  adminEmail: string;
  insurers: TenantInsurerInput[];
}

export interface CatalogInstalled {
  source: string;
  categories: number;
  policies: number;
}

export interface TenantActivated {
  tenant: ApiTenant;
  admin: { userId: string; email: string; temporaryPassword: string };
  catalogs: (CatalogInstalled & { insurerId: string })[];
}

export const platformKeys = {
  tenants: ["platform", "tenants"] as const,
  insurers: ["platform", "insurers"] as const,
};

export const platformApi = {
  insurers: () => apiRequest<ApiInsurer[]>("/platform/insurers"),
  createInsurer: (body: { code: string; name: string }) =>
    apiRequest<ApiInsurer>("/platform/insurers", { method: "POST", body }),
  tenants: (params: ListParams & { status?: string } = {}) =>
    apiRequestPaginated<ApiTenant>("/platform/tenants", { query: toQuery(params) }),
  activate: (body: ActivateTenantInput) =>
    apiRequest<TenantActivated>("/platform/tenants", { method: "POST", body }),
  update: (
    id: string,
    body: Partial<
      Pick<ApiTenant, "name" | "legalName" | "logoUrl" | "contactEmail" | "contactPhone">
    >,
  ) => apiRequest<ApiTenant>(`/platform/tenants/${id}`, { method: "PATCH", body }),
  addInsurer: (id: string, body: TenantInsurerInput) =>
    apiRequest<{ tenant: ApiTenant; catalog: CatalogInstalled }>(
      `/platform/tenants/${id}/insurers`,
      {
        method: "POST",
        body,
      },
    ),
  updateInsurerCodes: (
    id: string,
    insurerId: string,
    body: { businessCode?: string; licenceCode?: string; lines?: InsuranceType[] },
  ) =>
    apiRequest<ApiTenant>(`/platform/tenants/${id}/insurers/${insurerId}`, {
      method: "PATCH",
      body,
    }),
  suspend: (id: string) =>
    apiRequest<ApiTenant>(`/platform/tenants/${id}/suspend`, { method: "POST" }),
  reactivate: (id: string) =>
    apiRequest<ApiTenant>(`/platform/tenants/${id}/activate`, { method: "POST" }),
  resetAdminPassword: (id: string) =>
    apiRequest<{ email: string; temporaryPassword: string }>(
      `/platform/tenants/${id}/admin/reset-password`,
      { method: "POST" },
    ),
};

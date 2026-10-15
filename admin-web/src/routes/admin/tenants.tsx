import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Copy,
  ImagePlus,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { TenantLogo } from "@/components/TenantLogo";
import { requirePlatformSession } from "@/lib/admin-route-guard";
import {
  platformApi,
  platformKeys,
  retryUnlessClientError,
  type ApiInsurer,
  type ApiTenant,
  type ApiTenantInsurer,
  type InsuranceType,
} from "@/lib/api";
import type { TenantActivated, TenantInsurerInput } from "@/lib/api/platform";
import { readLogo } from "@/lib/read-logo";
import { AdminFooter } from "@/components/admin/AdminFooter";

export const Route = createFileRoute("/admin/tenants")({
  ssr: false,
  beforeLoad: requirePlatformSession,
  head: () => ({ meta: [{ title: "Tenants — InsuroX Prime" }] }),
  component: TenantsPage,
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

interface Credentials {
  title: string;
  email: string;
  password: string;
  note?: string;
}

function TenantsPage() {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [addingInsurer, setAddingInsurer] = useState(false);
  const [editingTenant, setEditingTenant] = useState<ApiTenant | null>(null);
  const [linkingTo, setLinkingTo] = useState<ApiTenant | null>(null);
  const [editingCodes, setEditingCodes] = useState<{
    tenant: ApiTenant;
    link: ApiTenantInsurer;
  } | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const tenants = useQuery({
    queryKey: platformKeys.tenants,
    queryFn: () => platformApi.tenants({ limit: 100, sortBy: "createdAt", order: "desc" }),
    retry: retryUnlessClientError,
  });
  const insurers = useQuery({
    queryKey: platformKeys.insurers,
    queryFn: platformApi.insurers,
    retry: retryUnlessClientError,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["platform"] });

  const toggle = useMutation({
    mutationFn: (tenant: ApiTenant) =>
      tenant.status === "ACTIVE"
        ? platformApi.suspend(tenant.id)
        : platformApi.reactivate(tenant.id),
    onSuccess: (tenant) => {
      toast.success(`${tenant.name} is now ${tenant.status.toLowerCase()}.`);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reset = useMutation({
    mutationFn: (tenant: ApiTenant) => platformApi.resetAdminPassword(tenant.id),
    onSuccess: (result, tenant) =>
      setCredentials({
        title: `New admin password for ${tenant.name}`,
        email: result.email,
        password: result.temporaryPassword,
        note: "Their current sessions were ended.",
      }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = tenants.data?.data ?? [];

  return (
    <div className="min-h-screen bg-surface/30 text-foreground">
      <Toaster position="top-right" richColors />
      <AdminSidebar
        currentPath="/admin/tenants"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-screen flex-col app-shell-pad">
        <AdminHeader onToggleSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Tenants
              </h1>
              <p className="text-xs text-muted-foreground">
                Each tenant is one agency attached to one insurer, with its own agents, customers
                and policy catalog.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddingInsurer(true)}
              >
                <Plus /> Add insurer
              </Button>
              <Button className="rounded-xl" onClick={() => setActivating(true)}>
                <Building2 /> Activate tenant
              </Button>
            </div>
          </div>

          {tenants.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading tenants…
            </div>
          )}
          {tenants.error !== null && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage(tenants.error)}
            </p>
          )}

          <div className="space-y-3">
            {rows.map((tenant) => (
              <article
                key={tenant.id}
                className="rounded-xl border border-border/80 bg-background/90 p-3 shadow-xs sm:rounded-2xl sm:p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <TenantLogo logoUrl={tenant.logoUrl} name={tenant.name} />
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-bold">
                        {tenant.name}{" "}
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            tenant.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {tenant.legalName} · Admin {tenant.adminEmail ?? "—"}
                      </p>
                      {(tenant.contactEmail || tenant.contactPhone) && (
                        <p className="text-xs text-muted-foreground">
                          {[tenant.contactEmail, tenant.contactPhone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setEditingTenant(tenant)}
                    >
                      <Pencil /> Edit tenant
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={reset.isPending}
                      onClick={() => reset.mutate(tenant)}
                    >
                      <KeyRound /> Reset admin password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(tenant)}
                    >
                      <Power /> {tenant.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-border/70">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Insurers
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg text-xs"
                      onClick={() => setLinkingTo(tenant)}
                    >
                      <Plus /> Add insurer
                    </Button>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {tenant.insurers.map((link) => (
                      <li
                        key={link.insurerId}
                        className="flex items-start justify-between gap-2 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{link.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Business code <span className="font-mono">{link.businessCode}</span> ·
                            Licence <span className="font-mono">{link.licenceCode}</span> ·{" "}
                            {link.policies} policies
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Sells: {link.lines.map(lineLabel).join(", ")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${link.name} codes and lines`}
                          title="Edit codes and lines"
                          className="size-8 rounded-lg text-muted-foreground"
                          onClick={() => setEditingCodes({ tenant, link })}
                        >
                          <Pencil />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {(
                    [
                      ["Agents", tenant.stats.agents],
                      ["Customers", tenant.stats.customers],
                      ["Policies in catalog", tenant.stats.policies],
                      ["Policies sold", tenant.stats.policiesSold],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-surface/60 p-2.5">
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="font-display text-lg font-extrabold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
            {tenants.data && rows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No tenants yet. Activate the first one.
              </p>
            )}
          </div>
        </main>
        <AdminFooter />
      </div>

      <ActivateDialog
        open={activating}
        insurers={insurers.data ?? []}
        onClose={() => setActivating(false)}
        onActivated={(result: TenantActivated) => {
          setActivating(false);
          refresh();
          setCredentials({
            title: `${result.tenant.name} is active`,
            email: result.admin.email,
            password: result.admin.temporaryPassword,
            note: `Catalogs loaded: ${result.catalogs.reduce((sum, item) => sum + item.categories, 0)} categories, ${result.catalogs.reduce((sum, item) => sum + item.policies, 0)} policies.`,
          });
        }}
      />
      <EditTenantDialog
        tenant={editingTenant}
        onClose={() => setEditingTenant(null)}
        onSaved={refresh}
      />
      <LinkInsurerDialog
        tenant={linkingTo}
        insurers={insurers.data ?? []}
        onClose={() => setLinkingTo(null)}
        onSaved={refresh}
      />
      <EditCodesDialog
        state={editingCodes}
        onClose={() => setEditingCodes(null)}
        onSaved={refresh}
      />
      <InsurerDialog
        open={addingInsurer}
        onClose={() => setAddingInsurer(false)}
        onSaved={refresh}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string | undefined;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wider">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 rounded-xl"
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The lines of business an agency can sell for an insurer. */
const LINE_OPTIONS: { line: InsuranceType; label: string }[] = [
  { line: "LIFE", label: "Life" },
  { line: "HEALTH", label: "Health" },
  { line: "MOTOR", label: "Motor" },
  { line: "COMMERCIAL", label: "Commercial" },
];

const lineLabel = (line: InsuranceType) =>
  LINE_OPTIONS.find((option) => option.line === line)?.label ?? line;

/** Tick boxes for the lines of business; at least one is needed. */
function LinePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: InsuranceType[];
  onChange: (lines: InsuranceType[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold uppercase tracking-wider">Lines of business sold</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {LINE_OPTIONS.map(({ line, label }) => {
          const checked = value.includes(line);
          return (
            <label
              key={line}
              htmlFor={`${idPrefix}-${line}`}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                checked ? "border-primary bg-primary/10 text-foreground" : "border-border/70"
              }`}
            >
              <input
                id={`${idPrefix}-${line}`}
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...value, line] : value.filter((item) => item !== line),
                  )
                }
              />
              {label}
            </label>
          );
        })}
      </div>
      {value.length === 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">Tick at least one.</p>
      )}
    </fieldset>
  );
}

interface InsurerRow {
  key: number;
  /** Free text: an existing insurer's name, or a new one that is created on save. */
  insurerName: string;
  businessCode: string;
  licenceCode: string;
  lines: InsuranceType[];
  /** Once the admin ticks a line themselves, picking another insurer no longer resets the ticks. */
  linesTouched: boolean;
  load: boolean;
}

const emptyRow = (key: number): InsurerRow => ({
  key,
  insurerName: "",
  businessCode: "",
  licenceCode: "",
  lines: [],
  linesTouched: false,
  load: true,
});

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const findInsurer = (row: InsurerRow, insurers: ApiInsurer[]) =>
  insurers.find(
    (item) => sameName(item.name, row.insurerName) || sameName(item.code, row.insurerName),
  );

const rowValid = (row: InsurerRow) =>
  row.insurerName.trim().length >= 2 &&
  row.businessCode.trim().length >= 2 &&
  row.licenceCode.trim().length >= 2 &&
  row.lines.length > 0;

/** "Tata AIA" → "TATA_AIA", the code the API requires for a new insurer. */
const toInsurerCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

/** Uses the typed insurer if it exists, otherwise creates it, then builds the API input. */
async function toInput(row: InsurerRow, known: ApiInsurer[]): Promise<TenantInsurerInput> {
  let insurer = findInsurer(row, known);
  if (!insurer) {
    const created = await platformApi.createInsurer({
      code: toInsurerCode(row.insurerName),
      name: row.insurerName.trim(),
    });
    known.push(created);
    insurer = created;
  }
  return {
    insurerId: insurer.id,
    businessCode: row.businessCode.trim(),
    licenceCode: row.licenceCode.trim(),
    lines: row.lines,
    catalog: {
      source:
        row.load && insurer.templateLines.some((line) => row.lines.includes(line))
          ? "TEMPLATE"
          : "NONE",
    },
  };
}

/** One insurer's choice, codes and starting catalog. */
function InsurerRowFields({
  row,
  insurers,
  takenNames,
  onChange,
  onRemove,
}: {
  row: InsurerRow;
  insurers: ApiInsurer[];
  takenNames: string[];
  onChange: (row: InsurerRow) => void;
  onRemove?: (() => void) | undefined;
}) {
  const insurer = findInsurer(row, insurers);
  const taken = takenNames.some((name) => sameName(name, row.insurerName));
  const canTemplate = Boolean(insurer?.templateLines.some((line) => row.lines.includes(line)));
  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs font-bold uppercase tracking-wider">Insurance company</Label>
          <Input
            list={`insurers-${row.key}`}
            value={row.insurerName}
            placeholder="e.g. TATA, LIC"
            onChange={(event) => {
              const insurerName = event.target.value;
              const match = findInsurer({ ...row, insurerName }, insurers);
              // Start from the lines the insurer's ready-made catalog covers.
              onChange({
                ...row,
                insurerName,
                ...(row.linesTouched ? {} : { lines: match?.templateLines ?? [] }),
              });
            }}
            className="mt-1 h-11 rounded-xl"
          />
          <datalist id={`insurers-${row.key}`}>
            {insurers
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.id} value={item.name} />
              ))}
          </datalist>
          {taken && (
            <p className="mt-1 text-[11px] text-destructive">
              This insurer is already added to the agency.
            </p>
          )}
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove insurer"
            onClick={onRemove}
            className="size-11 rounded-xl text-muted-foreground"
          >
            <Trash2 />
          </Button>
        )}
      </div>
      <LinePicker
        idPrefix={`lines-${row.key}`}
        value={row.lines}
        onChange={(lines) => onChange({ ...row, lines, linesTouched: true })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          id={`b-${row.key}`}
          label="Business code"
          value={row.businessCode}
          onChange={(value) => onChange({ ...row, businessCode: value })}
        />
        <Field
          id={`l-${row.key}`}
          label="Licence code"
          value={row.licenceCode}
          onChange={(value) => onChange({ ...row, licenceCode: value })}
        />
      </div>
      {insurer && !taken && (
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={row.load && canTemplate}
            disabled={!canTemplate}
            onChange={(event) => onChange({ ...row, load: event.target.checked })}
            className="mt-0.5"
          />
          <span>
            Load all categories and policy names for {insurer.name}
            {!canTemplate && (
              <span className="block text-[11px] text-muted-foreground">
                No ready-made catalog exists for the ticked lines; build it in the Catalog page.
              </span>
            )}
          </span>
        </label>
      )}
    </div>
  );
}

function ActivateDialog({
  open,
  insurers,
  onClose,
  onActivated,
}: {
  open: boolean;
  insurers: ApiInsurer[];
  onClose: () => void;
  onActivated: (result: TenantActivated) => void;
}) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [rows, setRows] = useState<InsurerRow[]>([emptyRow(1)]);

  const valid =
    name.trim().length >= 2 &&
    legalName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()) &&
    rows.every(rowValid) &&
    new Set(rows.map((row) => row.insurerName.trim().toLowerCase())).size === rows.length;

  const activate = useMutation({
    mutationFn: async () => {
      const known = [...insurers];
      const inputs: TenantInsurerInput[] = [];
      for (const row of rows) inputs.push(await toInput(row, known));
      return platformApi.activate({
        name: name.trim(),
        legalName: legalName.trim(),
        adminEmail: adminEmail.trim(),
        insurers: inputs,
      });
    },
    onSuccess: (result) => {
      setName("");
      setLegalName("");
      setAdminEmail("");
      setRows([emptyRow(1)]);
      onActivated(result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) activate.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Activate a tenant</DialogTitle>
            <DialogDescription>
              Creates the agency, its single admin account, and a policy catalog for each insurer it
              sells for.
            </DialogDescription>
          </DialogHeader>
          <Field id="t-name" label="Tenant name" value={name} onChange={setName} />
          <Field
            id="t-legal"
            label="Legal business name"
            value={legalName}
            onChange={setLegalName}
          />
          <Field
            id="t-admin"
            label="Admin email"
            type="email"
            value={adminEmail}
            onChange={setAdminEmail}
            hint="The tenant's single admin. A temporary password is shown once after activation."
          />
          {rows.map((row) => (
            <InsurerRowFields
              key={row.key}
              row={row}
              insurers={insurers}
              takenNames={rows
                .filter((item) => item.key !== row.key)
                .map((item) => item.insurerName)}
              onChange={(next) =>
                setRows((previous) => previous.map((item) => (item.key === row.key ? next : item)))
              }
              onRemove={
                rows.length > 1
                  ? () => setRows((previous) => previous.filter((item) => item.key !== row.key))
                  : undefined
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() =>
              setRows((previous) => [
                ...previous,
                emptyRow(Math.max(...previous.map((r) => r.key)) + 1),
              ])
            }
          >
            <Plus /> Add another insurer
          </Button>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={activate.isPending || !valid} className="rounded-xl">
              {activate.isPending && <Loader2 className="animate-spin" />} Activate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkInsurerDialog({
  tenant,
  insurers,
  onClose,
  onSaved,
}: {
  tenant: ApiTenant | null;
  insurers: ApiInsurer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<InsurerRow>(emptyRow(1));
  const linkTaken = Boolean(tenant?.insurers.some((link) => sameName(link.name, row.insurerName)));
  const save = useMutation({
    mutationFn: async () => platformApi.addInsurer(tenant!.id, await toInput(row, [...insurers])),
    onSuccess: (result) => {
      toast.success(
        `Added. Catalog loaded: ${result.catalog.categories} categories, ${result.catalog.policies} policies.`,
      );
      setRow(emptyRow(1));
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={tenant !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (rowValid(row) && !linkTaken) save.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add an insurer to {tenant?.name}</DialogTitle>
            <DialogDescription>
              Registers the agency&apos;s codes with another insurer and starts its catalog.
            </DialogDescription>
          </DialogHeader>
          <InsurerRowFields
            row={row}
            insurers={insurers}
            takenNames={tenant?.insurers.map((link) => link.name) ?? []}
            onChange={setRow}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !rowValid(row) || linkTaken}
              className="rounded-xl"
            >
              {save.isPending && <Loader2 className="animate-spin" />} Add insurer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantDialog({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: ApiTenant | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [lastId, setLastId] = useState("");
  const id = tenant?.id ?? "";
  if (id !== lastId) {
    setLastId(id);
    setName(tenant?.name ?? "");
    setLegalName(tenant?.legalName ?? "");
    setLogoUrl(tenant?.logoUrl ?? null);
    setContactEmail(tenant?.contactEmail ?? "");
    setContactPhone(tenant?.contactPhone ?? "");
  }
  const emailOk = contactEmail.trim() === "" || /^\S+@\S+\.\S+$/.test(contactEmail.trim());
  const phoneOk = contactPhone.trim() === "" || /^\+?[\d\s-]{7,20}$/.test(contactPhone.trim());
  const valid = name.trim().length >= 2 && legalName.trim().length >= 2 && emailOk && phoneOk;
  const save = useMutation({
    mutationFn: () =>
      platformApi.update(tenant!.id, {
        name: name.trim(),
        legalName: legalName.trim(),
        logoUrl,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Tenant updated.");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLogoUrl(await readLogo(file));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <Dialog open={tenant !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Edit {tenant?.name}</DialogTitle>
            <DialogDescription>
              The logo is shown to this tenant's admin and agents after they sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/80 bg-surface/60">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="size-full object-contain" />
              ) : (
                <ImagePlus className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="e-logo"
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-xs font-bold"
              >
                <ImagePlus className="size-4" /> {logoUrl ? "Change logo" : "Upload logo"}
              </Label>
              <input
                id="e-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  void pickLogo(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg text-xs text-destructive"
                  onClick={() => setLogoUrl(null)}
                >
                  <Trash2 /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">
                PNG, JPEG or WebP, resized to 256px.
              </p>
            </div>
          </div>
          <Field id="e-name" label="Agency name" value={name} onChange={setName} />
          <Field id="e-legal" label="Legal name" value={legalName} onChange={setLegalName} />
          <Field
            id="e-email"
            label="Contact email"
            type="email"
            value={contactEmail}
            onChange={setContactEmail}
            hint={emailOk ? undefined : "Enter a valid email address."}
          />
          <Field
            id="e-phone"
            label="Contact phone"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
            hint={phoneOk ? undefined : "Enter a valid phone number."}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !valid} className="rounded-xl">
              {save.isPending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCodesDialog({
  state,
  onClose,
  onSaved,
}: {
  state: { tenant: ApiTenant; link: ApiTenantInsurer } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessCode, setBusinessCode] = useState("");
  const [licenceCode, setLicenceCode] = useState("");
  const [lines, setLines] = useState<InsuranceType[]>([]);
  const [lastKey, setLastKey] = useState("");
  const key = state ? `${state.tenant.id}|${state.link.insurerId}` : "";
  if (key !== lastKey) {
    setLastKey(key);
    setBusinessCode(state?.link.businessCode ?? "");
    setLicenceCode(state?.link.licenceCode ?? "");
    setLines(state?.link.lines ?? []);
  }
  const valid =
    businessCode.trim().length >= 2 && licenceCode.trim().length >= 2 && lines.length > 0;
  const save = useMutation({
    mutationFn: () =>
      platformApi.updateInsurerCodes(state!.tenant.id, state!.link.insurerId, {
        businessCode: businessCode.trim(),
        licenceCode: licenceCode.trim(),
        lines,
      }),
    onSuccess: () => {
      toast.success("Insurer updated.");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Dialog open={state !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>
              {state?.tenant.name} · {state?.link.name}
            </DialogTitle>
            <DialogDescription>
              The business and policy-selling licence codes the insurer issued, and the lines of
              business the agency sells for it.
            </DialogDescription>
          </DialogHeader>
          <Field
            id="e-business"
            label="Business code"
            value={businessCode}
            onChange={setBusinessCode}
          />
          <Field
            id="e-licence"
            label="Licence code"
            value={licenceCode}
            onChange={setLicenceCode}
          />
          <LinePicker idPrefix="edit-lines" value={lines} onChange={setLines} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !valid} className="rounded-xl">
              {save.isPending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InsurerDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const valid = /^[A-Z0-9_]{2,30}$/.test(code) && name.trim().length >= 2;

  const save = useMutation({
    mutationFn: () => platformApi.createInsurer({ code, name: name.trim() }),
    onSuccess: () => {
      toast.success("Insurer added.");
      setCode("");
      setName("");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add an insurance company</DialogTitle>
            <DialogDescription>
              Use TATA_AIA or TATA_AIG to get a ready-made catalog at activation.
            </DialogDescription>
          </DialogHeader>
          <Field
            id="i-code"
            label="Code"
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            hint="Capital letters, digits and underscores, e.g. LIC or HDFC_LIFE."
          />
          <Field id="i-name" label="Name" value={name} onChange={setName} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !valid} className="rounded-xl">
              {save.isPending && <Loader2 className="animate-spin" />} Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: Credentials | null;
  onClose: () => void;
}) {
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  };
  return (
    <Dialog open={credentials !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{credentials?.title}</DialogTitle>
          <DialogDescription>
            Share these sign-in details with the tenant admin. The password is shown only now and
            must be changed on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          {(
            [
              ["Email", credentials?.email ?? ""],
              ["Temporary password", credentials?.password ?? ""],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 rounded-xl bg-surface/60 p-3"
            >
              <div className="min-w-0">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="select-all break-all font-mono font-semibold">{value}</dd>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Copy ${label}`}
                onClick={() => void copy(value)}
              >
                <Copy />
              </Button>
            </div>
          ))}
        </dl>
        {credentials?.note && <p className="text-xs text-muted-foreground">{credentials.note}</p>}
        <DialogFooter>
          <Button onClick={onClose} className="rounded-xl">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

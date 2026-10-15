import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderPlus, Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { requireAdminSession } from "@/lib/admin-route-guard";
import {
  catalogApi,
  catalogKeys,
  policiesApi,
  retryUnlessClientError,
  type CatalogCategory,
  type CatalogLine,
  type CatalogPolicy,
  type InsuranceType,
} from "@/lib/api";
import { formatDuration, formatINR, insuranceTypeLabel } from "@/lib/format";
import { AdminFooter } from "@/components/admin/AdminFooter";

export const Route = createFileRoute("/admin/catalog")({
  ssr: false,
  beforeLoad: requireAdminSession,
  head: () => ({ meta: [{ title: "Catalog — InsuroX Prime" }] }),
  component: CatalogPage,
});

const LINES: InsuranceType[] = ["LIFE", "HEALTH", "MOTOR", "COMMERCIAL"];
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

/** A readable policy code (3–30 letters, digits, dashes) from a policy name. */
const codeFromName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");

type CategoryDialog =
  | { mode: "create"; insurerId: string; line: InsuranceType; parent: CatalogCategory | null }
  | { mode: "rename"; id: string; name: string };

type PolicyDialog = {
  insurerId: string;
  line: InsuranceType;
  categoryId: string | null;
  /** Where the policy will sit, for the dialog subtitle. */
  place: string;
};

function CatalogPage() {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedInsurerId, setSelectedInsurerId] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<InsuranceType | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog | null>(null);
  const [policyDialog, setPolicyDialog] = useState<PolicyDialog | null>(null);

  const tree = useQuery({
    queryKey: catalogKeys.tree,
    queryFn: () => catalogApi.tree(),
    retry: retryUnlessClientError,
  });

  const insurers = tree.data?.insurers ?? [];
  const activeInsurer =
    insurers.find((item) => item.insurer.id === selectedInsurerId) ?? insurers[0];
  const insurerId = activeInsurer?.insurer.id ?? "";
  const lines = activeInsurer?.lines ?? [];
  const lineData = (line: InsuranceType): CatalogLine =>
    lines.find((item) => item.line === line) ?? { line, categories: [], policies: [] };
  const countPolicies = (line: CatalogLine) =>
    line.policies.length +
    line.categories.reduce(
      (total, category) =>
        total +
        category.policies.length +
        category.subCategories.reduce((sum, sub) => sum + sub.policies.length, 0),
      0,
    );
  // Only the lines the agency sells for this insurer.
  const visibleLines = lines.length
    ? LINES.filter((line) => lines.some((item) => item.line === line))
    : LINES;
  const activeLine =
    selectedLine && visibleLines.includes(selectedLine)
      ? selectedLine
      : (visibleLines[0] ?? "LIFE");
  const current = lineData(activeLine);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["policies"] });
  };
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const confirmDelete = (what: string, action: () => Promise<unknown>) => {
    if (window.confirm(`Delete ${what}? This cannot be undone.`)) {
      run.mutate(action, { onSuccess: () => toast.success(`Deleted ${what}.`) });
    }
  };

  return (
    <div className="min-h-screen bg-surface/30 text-foreground">
      <Toaster position="top-right" richColors />
      <AdminSidebar
        currentPath="/admin/catalog"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-screen flex-col app-shell-pad">
        <AdminHeader onToggleSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Policy catalog
              </h1>
              <p className="text-xs text-muted-foreground">
                {activeInsurer
                  ? `${activeInsurer.insurer.name}: lines, categories, sub-categories and policy names your agents pick from.`
                  : "Lines, categories, sub-categories and policy names your agents pick from."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() =>
                  setCategoryDialog({ mode: "create", insurerId, line: activeLine, parent: null })
                }
              >
                <FolderPlus /> Add category
              </Button>
              <Button
                className="rounded-xl"
                onClick={() =>
                  setPolicyDialog({
                    insurerId,
                    line: activeLine,
                    categoryId: null,
                    place: `${insuranceTypeLabel[activeLine]} line`,
                  })
                }
              >
                <Plus /> Add policy
              </Button>
            </div>
          </div>

          {insurers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Insurer">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Insurer
              </span>
              {insurers.map((item) => {
                const selected = item.insurer.id === insurerId;
                return (
                  <button
                    key={item.insurer.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setSelectedInsurerId(item.insurer.id);
                      setSelectedLine(null);
                    }}
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {item.insurer.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Line of business">
            {visibleLines.map((line) => {
              const data = lineData(line);
              const selected = line === activeLine;
              return (
                <button
                  key={line}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedLine(line)}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {insuranceTypeLabel[line]}{" "}
                  <span className="opacity-70">({countPolicies(data)})</span>
                </button>
              );
            })}
          </div>

          {tree.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading catalog…
            </div>
          )}
          {tree.error !== null && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage(tree.error)}{" "}
              <button className="underline" onClick={() => void tree.refetch()}>
                Retry
              </button>
            </p>
          )}

          {tree.data && current.categories.length === 0 && current.policies.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-background/70 p-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Layers className="size-6" />
              </span>
              <p className="mt-3 font-display text-lg font-bold">
                No {insuranceTypeLabel[activeLine]} categories or policies yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a category, then add policy names under it.
              </p>
            </div>
          )}

          {current.policies.length > 0 && (
            <Section title="Directly under this line">
              <PolicyList
                policies={current.policies}
                busy={run.isPending}
                onToggle={(policy) =>
                  run.mutate(() =>
                    policiesApi.setStatus(
                      policy.id,
                      policy.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    ),
                  )
                }
                onDelete={(policy) =>
                  confirmDelete(`"${policy.policyName}"`, () => policiesApi.remove(policy.id))
                }
              />
            </Section>
          )}

          {current.categories.map((category) => (
            <Section
              key={category.id}
              title={category.name}
              count={
                category.policies.length +
                category.subCategories.reduce((sum, sub) => sum + sub.policies.length, 0)
              }
              actions={
                <>
                  <IconButton
                    label="Add sub-category"
                    onClick={() =>
                      setCategoryDialog({
                        mode: "create",
                        insurerId,
                        line: activeLine,
                        parent: category,
                      })
                    }
                  >
                    <FolderPlus />
                  </IconButton>
                  <IconButton
                    label="Add policy here"
                    onClick={() =>
                      setPolicyDialog({
                        insurerId,
                        line: activeLine,
                        categoryId: category.id,
                        place: category.name,
                      })
                    }
                  >
                    <Plus />
                  </IconButton>
                  <IconButton
                    label="Rename category"
                    onClick={() =>
                      setCategoryDialog({ mode: "rename", id: category.id, name: category.name })
                    }
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label="Delete category"
                    onClick={() =>
                      confirmDelete(`category "${category.name}"`, () =>
                        catalogApi.removeCategory(category.id),
                      )
                    }
                  >
                    <Trash2 />
                  </IconButton>
                </>
              }
            >
              <PolicyList
                policies={category.policies}
                busy={run.isPending}
                onToggle={(policy) =>
                  run.mutate(() =>
                    policiesApi.setStatus(
                      policy.id,
                      policy.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    ),
                  )
                }
                onDelete={(policy) =>
                  confirmDelete(`"${policy.policyName}"`, () => policiesApi.remove(policy.id))
                }
              />
              {category.subCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="mt-3 rounded-xl border border-border/70 bg-surface/40 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      {sub.name}{" "}
                      <span className="text-xs font-medium text-muted-foreground">
                        ({sub.policies.length})
                      </span>
                    </p>
                    <div className="flex gap-1">
                      <IconButton
                        label="Add policy here"
                        onClick={() =>
                          setPolicyDialog({
                            insurerId,
                            line: activeLine,
                            categoryId: sub.id,
                            place: `${category.name} › ${sub.name}`,
                          })
                        }
                      >
                        <Plus />
                      </IconButton>
                      <IconButton
                        label="Rename sub-category"
                        onClick={() =>
                          setCategoryDialog({ mode: "rename", id: sub.id, name: sub.name })
                        }
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label="Delete sub-category"
                        onClick={() =>
                          confirmDelete(`sub-category "${sub.name}"`, () =>
                            catalogApi.removeCategory(sub.id),
                          )
                        }
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                  <PolicyList
                    policies={sub.policies}
                    busy={run.isPending}
                    onToggle={(policy) =>
                      run.mutate(() =>
                        policiesApi.setStatus(
                          policy.id,
                          policy.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        ),
                      )
                    }
                    onDelete={(policy) =>
                      confirmDelete(`"${policy.policyName}"`, () => policiesApi.remove(policy.id))
                    }
                  />
                </div>
              ))}
            </Section>
          ))}
        </main>
        <AdminFooter />
      </div>

      <CategoryDialogView
        state={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        onSaved={refresh}
      />
      <PolicyDialogView
        state={policyDialog}
        onClose={() => setPolicyDialog(null)}
        onSaved={refresh}
      />
    </div>
  );
}

function Section({
  title,
  count,
  actions,
  children,
}: {
  title: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-background/90 p-3 shadow-xs sm:rounded-2xl sm:p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs font-medium text-muted-foreground">
              {count} {count === 1 ? "policy" : "policies"}
            </span>
          )}
        </h2>
        {actions && <div className="flex gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="size-8 rounded-lg text-muted-foreground"
    >
      {children}
    </Button>
  );
}

function PolicyList({
  policies,
  busy,
  onToggle,
  onDelete,
}: {
  policies: CatalogPolicy[];
  busy: boolean;
  onToggle: (policy: CatalogPolicy) => void;
  onDelete: (policy: CatalogPolicy) => void;
}) {
  if (policies.length === 0) {
    return <p className="text-xs text-muted-foreground">No policies here yet.</p>;
  }
  return (
    <ul className="divide-y divide-border/60">
      {policies.map((policy) => (
        <li key={policy.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold ${
                policy.status === "INACTIVE" ? "text-muted-foreground line-through" : ""
              }`}
            >
              {policy.policyName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-mono">{policy.policyCode}</span> · Premium{" "}
              {formatINR(policy.premium)} · Term {formatDuration(policy.durationMonths)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onToggle(policy)}
              className="h-7 rounded-lg px-2.5 text-[11px]"
            >
              {policy.status === "ACTIVE" ? "Active" : "Inactive"}
            </Button>
            <IconButton label="Delete policy" onClick={() => onDelete(policy)}>
              <Trash2 />
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryDialogView({
  state,
  onClose,
  onSaved,
}: {
  state: CategoryDialog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [lastKey, setLastKey] = useState("");
  const key = state ? JSON.stringify(state) : "";
  if (key !== lastKey) {
    setLastKey(key);
    setName(state?.mode === "rename" ? state.name : "");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!state) return;
      if (state.mode === "rename") return catalogApi.updateCategory(state.id, { name });
      return catalogApi.createCategory({
        insurerId: state.insurerId,
        line: state.line,
        name,
        parentId: state.parent?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Saved.");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length >= 2) save.mutate();
  };

  const title =
    state?.mode === "rename"
      ? "Rename"
      : state?.parent
        ? `New sub-category in ${state.parent.name}`
        : state
          ? `New ${insuranceTypeLabel[state.line]} category`
          : "";

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {state?.mode === "create" && !state.parent
                ? "Categories group policies, e.g. Savings Solutions."
                : "Names must be unique among their siblings."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="category-name" className="text-xs font-bold uppercase tracking-wider">
              Name
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoFocus
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || name.trim().length < 2}
              className="rounded-xl"
            >
              {save.isPending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDialogView({
  state,
  onClose,
  onSaved,
}: {
  state: PolicyDialog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [premium, setPremium] = useState("");
  const [months, setMonths] = useState("");
  const [lastKey, setLastKey] = useState("");
  const key = state ? `${state.insurerId}|${state.line}|${state.categoryId}` : "";
  if (key !== lastKey) {
    setLastKey(key);
    setName("");
    setCode("");
    setCodeEdited(false);
    setPremium("");
    setMonths("");
  }

  const shownCode = codeEdited ? code : codeFromName(name);
  const valid = name.trim().length >= 2 && /^[A-Z0-9-]{3,30}$/.test(shownCode);

  const save = useMutation({
    mutationFn: () => {
      if (!state) return Promise.resolve(null);
      return policiesApi.create({
        policyCode: shownCode,
        policyName: name.trim(),
        insuranceType: state.line,
        insurerId: state.insurerId,
        categoryId: state.categoryId,
        description: "",
        coverageAmount: null,
        premium: premium ? Number(premium) : null,
        premiumFrequency: "ANNUAL",
        durationMonths: months ? Number(months) : null,
        eligibility: "",
        benefits: [],
        terms: "",
        categoryDetails: null,
        status: "ACTIVE",
      });
    },
    onSuccess: () => {
      toast.success("Policy added.");
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) save.mutate();
  };

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add policy</DialogTitle>
            <DialogDescription>
              In {state?.place}. Leave premium and term empty when the price is quoted on the
              insurer&apos;s portal; the agent enters it when recording a sale.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="policy-name" className="text-xs font-bold uppercase tracking-wider">
              Policy name
            </Label>
            <Input
              id="policy-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
              className="mt-1 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="policy-code" className="text-xs font-bold uppercase tracking-wider">
              Policy code
            </Label>
            <Input
              id="policy-code"
              value={shownCode}
              onChange={(event) => {
                setCodeEdited(true);
                setCode(event.target.value.toUpperCase());
              }}
              maxLength={30}
              className="mt-1 h-11 rounded-xl font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              3–30 capital letters, digits or dashes; unique in your catalog.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="policy-premium"
                className="text-xs font-bold uppercase tracking-wider"
              >
                Premium (₹), optional
              </Label>
              <Input
                id="policy-premium"
                type="number"
                min={1}
                value={premium}
                onChange={(event) => setPremium(event.target.value)}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="policy-months" className="text-xs font-bold uppercase tracking-wider">
                Term (months), optional
              </Label>
              <Input
                id="policy-months"
                type="number"
                min={1}
                max={600}
                value={months}
                onChange={(event) => setMonths(event.target.value)}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !valid} className="rounded-xl">
              {save.isPending && <Loader2 className="animate-spin" />} Add policy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

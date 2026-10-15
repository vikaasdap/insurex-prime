import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderPlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AddPoliciesDialog, type AddPoliciesTarget } from "@/components/catalog/AddPoliciesDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { requirePlatformSession } from "@/lib/admin-route-guard";
import {
  masterCatalogApi,
  masterCatalogKeys,
  retryUnlessClientError,
  type InsuranceType,
  type MasterCategory,
  type MasterInsurer,
  type MasterLine,
  type MasterPolicy,
} from "@/lib/api";

export const Route = createFileRoute("/admin/platform-catalog")({
  ssr: false,
  beforeLoad: requirePlatformSession,
  head: () => ({ meta: [{ title: "Insurer Catalog — InsuroX Prime" }] }),
  component: PlatformCatalogPage,
});

const LINES: { line: InsuranceType; label: string }[] = [
  { line: "LIFE", label: "Life" },
  { line: "HEALTH", label: "Health" },
  { line: "MOTOR", label: "Motor" },
  { line: "COMMERCIAL", label: "Commercial" },
];

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

const countPolicies = (line: MasterLine | undefined) =>
  !line
    ? 0
    : line.policies.length +
      line.categories.reduce(
        (total, category) =>
          total +
          category.policies.length +
          category.subCategories.reduce((sum, sub) => sum + sub.policies.length, 0),
        0,
      );

interface CategoryDraft {
  insurer: MasterInsurer["insurer"];
  line: InsuranceType;
  parent: { id: string; name: string } | null;
}

type Removal =
  { kind: "category"; id: string; name: string } | { kind: "policy"; id: string; name: string };

function PlatformCatalogPage() {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insurerId, setInsurerId] = useState("");
  const [line, setLine] = useState<InsuranceType>("LIFE");
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [policiesTarget, setPoliciesTarget] = useState<AddPoliciesTarget | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [confirmSync, setConfirmSync] = useState(false);

  const catalog = useQuery({
    queryKey: masterCatalogKeys.all,
    queryFn: masterCatalogApi.list,
    retry: retryUnlessClientError,
  });
  const insurers = catalog.data ?? [];
  const current = insurers.find((item) => item.insurer.id === insurerId) ?? insurers[0];
  const lineData = current?.lines.find((item) => item.line === line);

  const refresh = () => queryClient.invalidateQueries({ queryKey: masterCatalogKeys.all });

  const addCategory = useMutation({
    mutationFn: () =>
      masterCatalogApi.createCategory({
        insurerId: categoryDraft!.insurer.id,
        line: categoryDraft!.line,
        parentId: categoryDraft!.parent?.id ?? null,
        name: categoryName.trim(),
      }),
    onSuccess: async () => {
      toast.success("Added.");
      await refresh();
      setCategoryDraft(null);
      setCategoryName("");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (item: Removal) =>
      item.kind === "category"
        ? masterCatalogApi.removeCategory(item.id)
        : masterCatalogApi.removePolicy(item.id),
    onSuccess: async () => {
      toast.success("Removed. Agencies keep their own copy.");
      await refresh();
      setRemoval(null);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      setRemoval(null);
    },
  });

  const sync = useMutation({
    mutationFn: () => masterCatalogApi.syncTenants(current!.insurer.id),
    onSuccess: (result) => {
      toast.success(
        result.tenants === 0
          ? "No agency sells for this insurer yet."
          : `${result.tenants} ${result.tenants === 1 ? "agency" : "agencies"} updated: ${result.categoriesAdded} categories and ${result.policiesAdded} policies added.`,
      );
      setConfirmSync(false);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      setConfirmSync(false);
    },
  });

  const policyRow = (policy: MasterPolicy) => (
    <li key={policy.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
      <span className="min-w-0 truncate font-medium">{policy.policyName}</span>
      <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
        <span className="font-mono">{policy.policyCode}</span>
        {policy.uin && <span className="font-mono">UIN {policy.uin}</span>}
        <button
          type="button"
          aria-label={`Remove ${policy.policyName}`}
          className="cursor-pointer text-muted-foreground hover:text-destructive"
          onClick={() => setRemoval({ kind: "policy", id: policy.id, name: policy.policyName })}
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  );

  const addPolicies = (categoryId: string | null, categoryName: string) =>
    setPoliciesTarget({
      insurerId: current!.insurer.id,
      insuranceType: line,
      categoryId,
      categoryName,
    });

  const categoryBlock = (category: MasterCategory) => {
    const isEmpty =
      category.policies.length === 0 &&
      category.subCategories.every((sub) => sub.policies.length === 0) &&
      category.subCategories.length === 0;
    return (
      <div key={category.id} className="rounded-2xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
          <h3 className="font-display text-sm font-bold">{category.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-xs"
              onClick={() =>
                setCategoryDraft({
                  insurer: current!.insurer,
                  line,
                  parent: { id: category.id, name: category.name },
                })
              }
            >
              <FolderPlus /> Sub-category
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-xs"
              onClick={() => addPolicies(category.id, category.name)}
            >
              <Plus /> Policies
            </Button>
            {isEmpty && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${category.name}`}
                className="size-7 rounded-lg text-muted-foreground"
                onClick={() =>
                  setRemoval({ kind: "category", id: category.id, name: category.name })
                }
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        {category.policies.length > 0 && (
          <ul className="divide-y divide-border/50">{category.policies.map(policyRow)}</ul>
        )}
        {category.subCategories.map((sub) => (
          <div key={sub.id} className="border-t border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-3 py-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {sub.name} <span className="font-normal">({sub.policies.length})</span>
              </p>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-lg px-2 text-[11px]"
                  onClick={() => addPolicies(sub.id, `${category.name} › ${sub.name}`)}
                >
                  <Plus /> Policies
                </Button>
                {sub.policies.length === 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${sub.name}`}
                    className="size-6 rounded-lg text-muted-foreground"
                    onClick={() => setRemoval({ kind: "category", id: sub.id, name: sub.name })}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
            {sub.policies.length > 0 && (
              <ul className="divide-y divide-border/50">{sub.policies.map(policyRow)}</ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    if (categoryName.trim().length >= 2) addCategory.mutate();
  };

  return (
    <div className="min-h-screen bg-surface/30 text-foreground">
      <Toaster position="top-right" richColors />
      <AdminSidebar
        currentPath="/admin/platform-catalog"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-screen flex-col app-shell-pad">
        <AdminHeader onToggleSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 p-4 sm:p-6 lg:p-8">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Insurer Catalog
            </h1>
            <p className="text-xs text-muted-foreground">
              Every insurer&apos;s lines, categories, sub-categories and policies. A new agency
              starts from this list for the insurers and lines you pick when onboarding it.
            </p>
          </div>

          {catalog.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          )}
          {catalog.error !== null && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage(catalog.error)}
            </p>
          )}

          {current && (
            <>
              <div role="tablist" aria-label="Insurer" className="flex flex-wrap gap-2">
                {insurers.map((item) => {
                  const selected = item.insurer.id === current.insurer.id;
                  return (
                    <button
                      key={item.insurer.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setInsurerId(item.insurer.id)}
                      className={`cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {item.insurer.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="tablist" aria-label="Line of business" className="flex flex-wrap gap-2">
                  {LINES.map((item) => {
                    const data = current.lines.find((entry) => entry.line === item.line);
                    const selected = item.line === line;
                    return (
                      <button
                        key={item.line}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setLine(item.line)}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          selected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {item.label} <span className="opacity-70">({countPolicies(data)})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      setCategoryDraft({ insurer: current.insurer, line, parent: null })
                    }
                  >
                    <FolderPlus /> Add category
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      addPolicies(null, LINES.find((item) => item.line === line)!.label)
                    }
                  >
                    <Plus /> Add policies to line
                  </Button>
                  <Button className="rounded-xl" onClick={() => setConfirmSync(true)}>
                    <RefreshCw /> Apply to existing agencies
                  </Button>
                </div>
              </div>

              {!lineData ? (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nothing in {current.insurer.name} ·{" "}
                  {LINES.find((item) => item.line === line)!.label} yet. Add a category to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {lineData.categories.map(categoryBlock)}
                  {lineData.policies.length > 0 && (
                    <div className="rounded-2xl border border-border/70 bg-card">
                      <p className="border-b border-border/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Directly under the line
                      </p>
                      <ul className="divide-y divide-border/50">
                        {lineData.policies.map(policyRow)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        <AdminFooter />
      </div>

      <Dialog
        open={categoryDraft !== null}
        onOpenChange={(next) => !next && setCategoryDraft(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <form onSubmit={submitCategory} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {categoryDraft?.parent ? "Add sub-category" : "Add category"}
              </DialogTitle>
              <DialogDescription>
                {categoryDraft?.insurer.name} ·{" "}
                {LINES.find((item) => item.line === categoryDraft?.line)?.label}
                {categoryDraft?.parent ? ` · under ${categoryDraft.parent.name}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label
                htmlFor="master-cat-name"
                className="text-xs font-bold uppercase tracking-wider"
              >
                Name
              </Label>
              <Input
                id="master-cat-name"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Whole Life Plans"
                className="mt-1 h-11 rounded-xl"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setCategoryDraft(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl"
                disabled={addCategory.isPending || categoryName.trim().length < 2}
              >
                {addCategory.isPending && <Loader2 className="animate-spin" />} Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddPoliciesDialog
        target={policiesTarget}
        onClose={() => setPoliciesTarget(null)}
        invalidateKeys={[masterCatalogKeys.all]}
        submit={(target, policies) =>
          masterCatalogApi.createPolicies({
            insurerId: target.insurerId,
            insuranceType: target.insuranceType,
            categoryId: target.categoryId,
            policies,
          })
        }
      />

      <AlertDialog open={removal !== null} onOpenChange={(next) => !next && setRemoval(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removal?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the master list only. Agencies that already have it keep their own
              copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => removal && remove.mutate(removal)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSync} onOpenChange={setConfirmSync}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to existing agencies?</AlertDialogTitle>
            <AlertDialogDescription>
              Every agency that sells for {current?.insurer.name} gets any categories and policies
              it is missing, for the lines it has enabled. Nothing an agency already has is changed
              or removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={() => sync.mutate()}>
              {sync.isPending && <Loader2 className="animate-spin" />} Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

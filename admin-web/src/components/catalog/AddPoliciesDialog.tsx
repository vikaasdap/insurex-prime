import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "@/components/agent/agent-ui";
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
import { agentKeys } from "@/lib/agent-queries";
import { catalogKeys, policiesApi, type InsuranceType } from "@/lib/api";
import type { BulkPolicyRow } from "@/lib/api/policies";

interface Row {
  key: number;
  policyName: string;
  policyCode: string;
  uin: string;
}

const blankRow = (key: number): Row => ({ key, policyName: "", policyCode: "", uin: "" });

export interface AddPoliciesTarget {
  insurerId: string;
  insuranceType: InsuranceType;
  /** Category (or sub-category) the policies go under; null puts them directly under the line. */
  categoryId: string | null;
  /** Shown read-only at the top, e.g. "Insurance Plans". */
  categoryName: string;
}

/**
 * Adds one or more policies to the chosen category, then refreshes every catalog list. By default
 * they go into the signed-in agency's catalog; `submit` redirects them (e.g. to the master catalog).
 */
export function AddPoliciesDialog({
  target,
  onClose,
  submit,
  invalidateKeys,
}: {
  target: AddPoliciesTarget | null;
  onClose: () => void;
  submit?: (target: AddPoliciesTarget, policies: BulkPolicyRow[]) => Promise<{ created: number }>;
  /** Query keys to refresh after saving, instead of the agency catalog lists. */
  invalidateKeys?: readonly (readonly unknown[])[];
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([blankRow(1)]);
  const [nextKey, setNextKey] = useState(2);

  const reset = () => {
    setRows([blankRow(1)]);
    setNextKey(2);
  };
  const close = () => {
    reset();
    onClose();
  };
  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const names = rows.map((row) => row.policyName.trim().toLowerCase());
  const duplicate = names.some((name, index) => name && names.indexOf(name) !== index);
  const valid = rows.every((row) => row.policyName.trim().length >= 2) && !duplicate;

  const save = useMutation({
    mutationFn: () => {
      const policies = rows.map((row) => ({
        policyName: row.policyName.trim(),
        policyCode: row.policyCode.trim(),
        uin: row.uin.trim(),
      }));
      return submit
        ? submit(target!, policies)
        : policiesApi.createMany({
            insuranceType: target!.insuranceType,
            insurerId: target!.insurerId,
            categoryId: target!.categoryId,
            policies,
          });
    },
    onSuccess: async (result) => {
      toast.success(`${result.created} ${result.created === 1 ? "policy" : "policies"} added.`);
      const keys = invalidateKeys ?? [[...agentKeys.all, "catalog-tree"], catalogKeys.all];
      await Promise.all(
        keys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
      );
      close();
    },
    onError: (error) => toast.error(errorText(error, "Couldn't add the policies.")),
  });

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save.mutate();
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add policies</DialogTitle>
            <DialogDescription>
              Add one or more policies to this category. They appear in the policy list straight
              away.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label className="text-xs font-bold uppercase tracking-wider">Category</Label>
            <Input
              value={target?.categoryName ?? ""}
              readOnly
              className="mt-1 h-11 rounded-xl bg-muted/40"
            />
          </div>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.key} className="space-y-2 rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Policy {index + 1}
                  </p>
                  {rows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove policy ${index + 1}`}
                      className="size-8 rounded-lg text-muted-foreground"
                      onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div>
                  <Label htmlFor={`pol-name-${row.key}`} className="text-xs">
                    Policy name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`pol-name-${row.key}`}
                    value={row.policyName}
                    onChange={(event) => update(row.key, { policyName: event.target.value })}
                    placeholder="e.g. Jeevan Anand"
                    className="mt-1 h-10 rounded-xl"
                    autoFocus={index === rows.length - 1 && index > 0}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`pol-code-${row.key}`} className="text-xs">
                      Policy code
                    </Label>
                    <Input
                      id={`pol-code-${row.key}`}
                      value={row.policyCode}
                      onChange={(event) => update(row.key, { policyCode: event.target.value })}
                      placeholder="Made from the name if blank"
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`pol-uin-${row.key}`} className="text-xs">
                      UIN number
                    </Label>
                    <Input
                      id={`pol-uin-${row.key}`}
                      value={row.uin}
                      onChange={(event) => update(row.key, { uin: event.target.value })}
                      placeholder="e.g. 512N277V02"
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {duplicate && (
            <p className="text-xs text-destructive">The same policy name is listed twice.</p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            disabled={rows.length >= 50}
            onClick={() => {
              setRows((current) => [...current, blankRow(nextKey)]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus /> Add another policy
          </Button>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !valid} className="rounded-xl">
              {save.isPending && <Loader2 className="animate-spin" />}
              Save {rows.length > 1 ? `${rows.length} policies` : "policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Umbrella,
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  HeartPulse,
  MoreHorizontal,
  Plus,
  Power,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Table,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { usePolicyCatalog, type PolicyCatalog, type PolicyKpis } from "@/hooks/use-policy-catalog";
import { SelectField } from "@/components/ui/select-field";
import { AdminFooter } from "@/components/admin/AdminFooter";
import {
  formatINR,
  formatPolicyDuration,
  motorCoverageTypes,
  policyDurationOptions,
  policyTypeColors,
  premiumFrequencies,
  premiumRanges,
  vehicleTypes,
  type HealthPolicyDetails,
  type MotorPolicyDetails,
  type PolicyInsuranceType,
  type PolicyProduct,
  type PolicyProductStatus,
  type PremiumFrequency,
} from "@/components/admin/policies-mock-data";

export const Route = createFileRoute("/admin/policies")({
  ssr: false,
  beforeLoad: requireAdminSession,
  head: () => ({
    meta: [
      { title: "Policy Management — InsuroX Prime" },
      {
        name: "description",
        content: "Manage InsuroX insurance products, plans, coverage and premiums.",
      },
    ],
  }),
  component: AdminPoliciesPage,
});

// ─── Form model ───────────────────────────────────────────────────────────────
type HealthFormData = Omit<HealthPolicyDetails, "sumInsured"> & { sumInsured: string };

interface PolicyFormData {
  name: string;
  code: string;
  type: PolicyInsuranceType;
  description: string;
  coverageAmount: string;
  premium: string;
  premiumFrequency: PremiumFrequency;
  durationMonths: number;
  eligibility: string;
  benefits: string; // one benefit per line
  terms: string;
  status: PolicyProductStatus;
  health: HealthFormData;
  motor: MotorPolicyDetails;
}

const emptyHealthForm: HealthFormData = {
  planType: "Individual",
  sumInsured: "",
  hospitalizationCoverage: "",
  waitingPeriod: "",
  ageEligibility: "",
};

const emptyMotorForm: MotorPolicyDetails = {
  vehicleType: "Private Car",
  coverageType: "Comprehensive",
  ownDamage: "",
  thirdPartyCoverage: "",
  vehicleEligibility: "",
};

const emptyPolicyForm: PolicyFormData = {
  name: "",
  code: "",
  type: "Health",
  description: "",
  coverageAmount: "",
  premium: "",
  premiumFrequency: "Annual",
  durationMonths: 12,
  eligibility: "",
  benefits: "",
  terms: "",
  status: "Active",
  health: emptyHealthForm,
  motor: emptyMotorForm,
};

function toPolicyForm(policy: PolicyProduct): PolicyFormData {
  return {
    name: policy.name,
    code: policy.code,
    type: policy.type,
    description: policy.description,
    coverageAmount: String(policy.coverageAmount),
    premium: String(policy.premium),
    premiumFrequency: policy.premiumFrequency,
    durationMonths: policy.durationMonths,
    eligibility: policy.eligibility,
    benefits: policy.benefits.join("\n"),
    terms: policy.terms,
    status: policy.status,
    health:
      policy.type === "Health"
        ? { ...policy.health, sumInsured: String(policy.health.sumInsured) }
        : emptyHealthForm,
    motor: policy.type === "Motor" ? { ...policy.motor } : emptyMotorForm,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fromPolicyForm(
  form: PolicyFormData,
  base: Pick<PolicyProduct, "id" | "policiesSold">,
): PolicyProduct {
  const shared = {
    id: base.id,
    policiesSold: base.policiesSold,
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim(),
    coverageAmount: Number(form.coverageAmount),
    premium: Number(form.premium),
    premiumFrequency: form.premiumFrequency,
    durationMonths: form.durationMonths,
    eligibility: form.eligibility.trim(),
    benefits: form.benefits
      .split("\n")
      .map((benefit) => benefit.trim())
      .filter(Boolean),
    terms: form.terms.trim(),
    status: form.status,
    lastUpdated: todayIso(),
  };
  if (form.type === "Health") {
    return {
      ...shared,
      type: "Health",
      health: {
        ...form.health,
        sumInsured: Number(form.health.sumInsured) || shared.coverageAmount,
      },
    };
  }
  if (form.type === "Motor") return { ...shared, type: "Motor", motor: { ...form.motor } };
  return { ...shared, type: form.type };
}

function formatUpdated(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusStyles: Record<PolicyProductStatus, string> = {
  Active: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Inactive: "border-border bg-muted text-muted-foreground",
};

const typeStyles: Record<PolicyInsuranceType, string> = {
  Health: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
  Motor: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Life: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Commercial: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

const typeIcons = {
  Health: HeartPulse,
  Motor: Car,
  Life: Umbrella,
  Commercial: Building2,
} as const;

const selectClass =
  "h-9 rounded-xl border border-border bg-surface/50 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary";

// ─── Small presentational pieces ──────────────────────────────────────────────
function PolicyStatusBadge({ status }: { status: PolicyProductStatus }) {
  return (
    <Badge variant="outline" className={`rounded-full font-bold ${statusStyles[status]}`}>
      {status === "Active" && <CheckCircle2 className="mr-1 size-3" />}
      {status}
    </Badge>
  );
}

function PolicyTypeBadge({ type }: { type: PolicyInsuranceType }) {
  const Icon = typeIcons[type];
  return (
    <Badge variant="outline" className={`rounded-full font-semibold ${typeStyles[type]}`}>
      <Icon className="mr-1 size-3" />
      {type}
    </Badge>
  );
}

function PolicyKpiCards({ kpis }: { kpis: PolicyKpis }) {
  const cards = [
    {
      label: "Total Policies",
      value: kpis.total,
      hint: `${kpis.total - kpis.active} inactive`,
      icon: Shield,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active Policies",
      value: kpis.active,
      hint: "Available to agents",
      icon: ShieldCheck,
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Health Policies",
      value: kpis.health,
      hint: `${kpis.healthActive} active`,
      icon: HeartPulse,
      color: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-500/10",
    },
    {
      label: "Motor Policies",
      value: kpis.motor,
      hint: `${kpis.motorActive} active`,
      icon: Car,
      color: "text-sky-700 dark:text-sky-400",
      bg: "bg-sky-500/10",
    },
    // Life and commercial cards appear once the catalog has such policies.
    ...(kpis.life > 0
      ? [
          {
            label: "Life Policies",
            value: kpis.life,
            hint: `${kpis.lifeActive} active`,
            icon: Umbrella,
            color: "text-amber-700 dark:text-amber-400",
            bg: "bg-amber-500/10",
          },
        ]
      : []),
    ...(kpis.commercial > 0
      ? [
          {
            label: "Commercial Policies",
            value: kpis.commercial,
            hint: `${kpis.commercialActive} active`,
            icon: Building2,
            color: "text-violet-700 dark:text-violet-400",
            bg: "bg-violet-500/10",
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label="Policy statistics"
      className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-xl border border-border/80 bg-background/90 p-3 shadow-xs sm:rounded-2xl sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-lg sm:size-9 sm:rounded-xl ${card.bg} ${card.color}`}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 font-display text-xl font-extrabold text-foreground sm:mt-3 sm:text-2xl">
              {card.value.toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{card.hint}</p>
          </article>
        );
      })}
    </section>
  );
}

function PolicyAnalytics({
  salesByType,
  topPolicies: top,
}: Pick<PolicyCatalog, "salesByType" | "topPolicies">) {
  const typeData = salesByType.map((item) => ({
    name: item.type,
    sold: item.sold,
    color: policyTypeColors[item.type],
  }));
  const totalSold = typeData.reduce((total, item) => total + item.sold, 0);
  const topPolicies = top.map((policy) => ({
    name: policy.name,
    sold: policy.sold,
    color: policyTypeColors[policy.type],
  }));

  return (
    <section aria-label="Policy analytics" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-xs sm:rounded-2xl sm:p-5 lg:col-span-2">
        <h2 className="font-display text-base font-bold">Policy Sales by Type</h2>
        <p className="text-xs text-muted-foreground">Policies sold across the catalog</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="sold"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={4}
                >
                  {typeData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const item = payload?.[0]?.payload as (typeof typeData)[number] | undefined;
                    if (!active || !item) return null;
                    return (
                      <div className="rounded-xl border border-border bg-background p-2.5 text-xs shadow-md">
                        <p className="font-bold">{item.name}</p>
                        <p className="text-muted-foreground">
                          {item.sold.toLocaleString("en-IN")} sold
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground">Total sold</span>
              <span className="font-display text-lg font-extrabold">
                {totalSold.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {typeData.map((item) => (
              <div key={item.name} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="font-bold">{item.sold.toLocaleString("en-IN")}</span>
                </div>
                <p className="mt-0.5 pl-4.5 text-[11px] text-muted-foreground">
                  {totalSold ? Math.round((item.sold / totalSold) * 100) : 0}% of sales
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-xs sm:rounded-2xl sm:p-5 lg:col-span-3">
        <h2 className="font-display text-base font-bold">Top Policies by Sales</h2>
        <p className="text-xs text-muted-foreground">Five best-selling products</p>
        <div className="mt-2 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topPolicies}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="currentColor"
                opacity={0.08}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "currentColor", opacity: 0.04 }}
                content={({ active, payload }) => {
                  const item = payload?.[0]?.payload as (typeof topPolicies)[number] | undefined;
                  if (!active || !item) return null;
                  return (
                    <div className="rounded-xl border border-border bg-background p-2.5 text-xs shadow-md">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-muted-foreground">
                        {item.sold.toLocaleString("en-IN")} sold
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="sold" radius={[0, 6, 6, 0]} barSize={14}>
                {topPolicies.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────
function PolicyFormModal({
  mode,
  initial,
  existingCodes,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  initial: PolicyFormData;
  existingCodes: string[];
  onClose: () => void;
  onSubmit: (data: PolicyFormData) => void | Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const setField = <K extends keyof PolicyFormData>(key: K, value: PolicyFormData[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const setHealth = <K extends keyof HealthFormData>(key: K, value: HealthFormData[K]) =>
    setForm((previous) => ({ ...previous, health: { ...previous.health, [key]: value } }));
  const setMotor = <K extends keyof MotorPolicyDetails>(key: K, value: MotorPolicyDetails[K]) =>
    setForm((previous) => ({ ...previous, motor: { ...previous.motor, [key]: value } }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const code = form.code.trim().toUpperCase();
    if (existingCodes.includes(code)) {
      toast.error(`Policy code ${code} is already in use.`);
      return;
    }
    if (!(Number(form.premium) > 0) || !(Number(form.coverageAmount) > 0)) {
      toast.error("Coverage amount and premium must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = "mt-1 h-10 rounded-xl";
  const formSelectClass = `w-full border border-input bg-background px-3 text-sm ${fieldClass}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">
            {mode === "add" ? "Add Policy" : "Edit Policy"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "add"
              ? "Create an insurance product in the local demo catalog."
              : "Update product, coverage and premium details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="policy-name">Policy name *</Label>
              <Input
                id="policy-name"
                className={fieldClass}
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="policy-code">Policy code *</Label>
              <Input
                id="policy-code"
                className={`${fieldClass} uppercase`}
                placeholder="HLT-XXX-000"
                value={form.code}
                onChange={(event) => setField("code", event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="policy-type">Insurance type</Label>
              <SelectField
                id="policy-type"
                className={formSelectClass}
                value={form.type}
                onChange={(event) => setField("type", event.target.value as PolicyInsuranceType)}
              >
                <option value="Health">Health Insurance</option>
                <option value="Motor">Motor / Car Insurance</option>
                <option value="Life">Life Insurance</option>
                <option value="Commercial">Commercial Insurance</option>
              </SelectField>
            </div>
            <div>
              <Label htmlFor="policy-status">Status</Label>
              <SelectField
                id="policy-status"
                className={formSelectClass}
                value={form.status}
                onChange={(event) => setField("status", event.target.value as PolicyProductStatus)}
              >
                <option value="Active">Active — available to agents</option>
                <option value="Inactive">Inactive — hidden from agents</option>
              </SelectField>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="policy-description">Description</Label>
              <Textarea
                id="policy-description"
                className="mt-1 min-h-16 rounded-xl"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="policy-coverage">Coverage amount (₹) *</Label>
              <Input
                id="policy-coverage"
                type="number"
                min={1}
                inputMode="numeric"
                className={fieldClass}
                value={form.coverageAmount}
                onChange={(event) => setField("coverageAmount", event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="policy-premium">Premium (₹) *</Label>
              <Input
                id="policy-premium"
                type="number"
                min={1}
                inputMode="numeric"
                className={fieldClass}
                value={form.premium}
                onChange={(event) => setField("premium", event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="policy-frequency">Premium frequency</Label>
              <SelectField
                id="policy-frequency"
                className={formSelectClass}
                value={form.premiumFrequency}
                onChange={(event) =>
                  setField("premiumFrequency", event.target.value as PremiumFrequency)
                }
              >
                {premiumFrequencies.map((frequency) => (
                  <option key={frequency}>{frequency}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <Label htmlFor="policy-duration">Duration</Label>
              <SelectField
                id="policy-duration"
                className={formSelectClass}
                value={form.durationMonths}
                onChange={(event) => setField("durationMonths", Number(event.target.value))}
              >
                {policyDurationOptions.map((months) => (
                  <option key={months} value={months}>
                    {formatPolicyDuration(months)}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="policy-eligibility">Eligibility</Label>
              <Input
                id="policy-eligibility"
                className={fieldClass}
                value={form.eligibility}
                onChange={(event) => setField("eligibility", event.target.value)}
              />
            </div>
          </div>

          <fieldset className="rounded-xl border border-border bg-surface/40 p-4">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
              {(() => {
                const LegendIcon = typeIcons[form.type];
                return <LegendIcon className="size-4 text-primary" />;
              })()}
              {form.type === "Health" || form.type === "Motor"
                ? `${form.type} coverage details`
                : `${form.type} plan details`}
            </legend>
            {form.type === "Health" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="health-plan">Individual / Family</Label>
                  <SelectField
                    id="health-plan"
                    className={formSelectClass}
                    value={form.health.planType}
                    onChange={(event) =>
                      setHealth("planType", event.target.value as HealthPolicyDetails["planType"])
                    }
                  >
                    <option>Individual</option>
                    <option>Family</option>
                  </SelectField>
                </div>
                <div>
                  <Label htmlFor="health-sum">Sum insured (₹)</Label>
                  <Input
                    id="health-sum"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Defaults to coverage amount"
                    className={fieldClass}
                    value={form.health.sumInsured}
                    onChange={(event) => setHealth("sumInsured", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="health-hospital">Hospitalization coverage</Label>
                  <Input
                    id="health-hospital"
                    className={fieldClass}
                    value={form.health.hospitalizationCoverage}
                    onChange={(event) => setHealth("hospitalizationCoverage", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="health-waiting">Waiting period</Label>
                  <Input
                    id="health-waiting"
                    className={fieldClass}
                    value={form.health.waitingPeriod}
                    onChange={(event) => setHealth("waitingPeriod", event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="health-age">Age eligibility</Label>
                  <Input
                    id="health-age"
                    className={fieldClass}
                    placeholder="e.g. 18–65 years"
                    value={form.health.ageEligibility}
                    onChange={(event) => setHealth("ageEligibility", event.target.value)}
                  />
                </div>
              </div>
            ) : form.type === "Motor" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="motor-vehicle">Vehicle type</Label>
                  <SelectField
                    id="motor-vehicle"
                    className={formSelectClass}
                    value={form.motor.vehicleType}
                    onChange={(event) =>
                      setMotor(
                        "vehicleType",
                        event.target.value as MotorPolicyDetails["vehicleType"],
                      )
                    }
                  >
                    {vehicleTypes.map((vehicle) => (
                      <option key={vehicle}>{vehicle}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label htmlFor="motor-coverage">Coverage type</Label>
                  <SelectField
                    id="motor-coverage"
                    className={formSelectClass}
                    value={form.motor.coverageType}
                    onChange={(event) =>
                      setMotor(
                        "coverageType",
                        event.target.value as MotorPolicyDetails["coverageType"],
                      )
                    }
                  >
                    {motorCoverageTypes.map((coverage) => (
                      <option key={coverage}>{coverage}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label htmlFor="motor-od">Own damage</Label>
                  <Input
                    id="motor-od"
                    className={fieldClass}
                    value={form.motor.ownDamage}
                    onChange={(event) => setMotor("ownDamage", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="motor-tp">Third party coverage</Label>
                  <Input
                    id="motor-tp"
                    className={fieldClass}
                    value={form.motor.thirdPartyCoverage}
                    onChange={(event) => setMotor("thirdPartyCoverage", event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="motor-eligibility">Vehicle eligibility</Label>
                  <Input
                    id="motor-eligibility"
                    className={fieldClass}
                    placeholder="e.g. Private cars up to 10 years old"
                    value={form.motor.vehicleEligibility}
                    onChange={(event) => setMotor("vehicleEligibility", event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-3">
              <Label htmlFor="policy-benefits">Key benefits</Label>
              <Textarea
                id="policy-benefits"
                className="mt-1 min-h-20 rounded-xl"
                placeholder="One benefit per line"
                value={form.benefits}
                onChange={(event) => setField("benefits", event.target.value)}
              />
            </div>
          </fieldset>

          <div>
            <Label htmlFor="policy-terms">Terms / notes</Label>
            <Textarea
              id="policy-terms"
              className="mt-1 min-h-16 rounded-xl"
              value={form.terms}
              onChange={(event) => setField("terms", event.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {mode === "add" ? "Create Policy" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── View modal ───────────────────────────────────────────────────────────────
function PolicyDetailsDialog({
  policy,
  onClose,
  onEdit,
  onToggleStatus,
}: {
  policy: PolicyProduct;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const categoryDetails =
    policy.type === "Health"
      ? [
          { label: "Individual / Family", value: policy.health.planType },
          { label: "Sum insured", value: formatINR(policy.health.sumInsured) },
          { label: "Hospitalization coverage", value: policy.health.hospitalizationCoverage },
          { label: "Waiting period", value: policy.health.waitingPeriod },
          { label: "Age eligibility", value: policy.health.ageEligibility },
        ]
      : policy.type === "Motor"
        ? [
            { label: "Vehicle type", value: policy.motor.vehicleType },
            { label: "Coverage type", value: policy.motor.coverageType },
            { label: "Own damage", value: policy.motor.ownDamage },
            { label: "Third party coverage", value: policy.motor.thirdPartyCoverage },
            { label: "Vehicle eligibility", value: policy.motor.vehicleEligibility },
          ]
        : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="block max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader className="mb-5 pr-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl font-bold">{policy.name}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {policy.code} · Updated {formatUpdated(policy.lastUpdated)}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onToggleStatus}>
                <Power className="size-3.5" />
                {policy.status === "Active" ? "Deactivate" : "Activate"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Edit2 className="size-3.5" /> Edit
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-5">
          <section className="flex flex-wrap items-center gap-2">
            <PolicyTypeBadge type={policy.type} />
            <PolicyStatusBadge status={policy.status} />
            <span className="text-xs text-muted-foreground">
              {policy.status === "Active"
                ? "Available for agent policy selection"
                : "Hidden from agents — visible to Super Admin only"}
            </span>
          </section>

          {policy.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{policy.description}</p>
          )}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Coverage amount", value: formatINR(policy.coverageAmount) },
              {
                label: "Premium",
                value: formatINR(policy.premium),
                sub: policy.premiumFrequency,
              },
              { label: "Policy duration", value: formatPolicyDuration(policy.durationMonths) },
              { label: "Policies sold", value: policy.policiesSold.toLocaleString("en-IN") },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-display text-base font-bold">{item.value}</p>
                {item.sub && <p className="text-[11px] text-muted-foreground">{item.sub}</p>}
              </div>
            ))}
          </section>

          {categoryDetails.length > 0 && (
            <section>
              <h3 className="mb-2 font-display font-bold">{policy.type} coverage</h3>
              <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-surface/40 p-4 text-xs sm:grid-cols-2">
                {categoryDetails.map((item) => (
                  <div key={item.label} className="min-w-0">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="mt-0.5 break-words font-semibold">{item.value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-display font-bold">Benefits</h3>
              {policy.benefits.length ? (
                <ul className="space-y-1.5 text-xs">
                  {policy.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No benefits listed.</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 font-display font-bold">Eligibility</h3>
                <p className="text-xs text-muted-foreground">
                  {policy.eligibility || "Not specified."}
                </p>
              </div>
              {policy.terms && (
                <div>
                  <h3 className="mb-1 font-display font-bold">Terms / notes</h3>
                  <p className="text-xs text-muted-foreground">{policy.terms}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────
function PolicyRowActions({
  policy,
  onView,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: {
  policy: PolicyProduct;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onView}
        aria-label={`View ${policy.name}`}
        title="View policy"
      >
        <Eye className="size-4" />
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${policy.name}`}
            title="More actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onView}>
            <Eye /> View
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <Edit2 /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleStatus}>
            <Power /> {policy.status === "Active" ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function AdminPoliciesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | PolicyInsuranceType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | PolicyProductStatus>("All");
  const [premiumFilter, setPremiumFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<PolicyProduct | null>(null);
  const [viewPolicyId, setViewPolicyId] = useState<string | null>(null);
  const [deletePolicy, setDeletePolicy] = useState<PolicyProduct | null>(null);
  const pageSize = 10;

  // Demo data, or the backend API when VITE_API_BASE_URL is set (filtering then
  // happens in the database).
  const catalog = usePolicyCatalog({
    search,
    type: typeFilter,
    status: statusFilter,
    premiumRangeId: premiumFilter,
    page,
    pageSize,
  });

  const totalPages = catalog.totalPages;
  const currentPage = Math.min(page, totalPages);
  useEffect(() => {
    if (!catalog.isLoading && page > catalog.totalPages) setPage(catalog.totalPages);
  }, [page, catalog.totalPages, catalog.isLoading]);

  const visiblePolicies = catalog.rows;
  const viewPolicy = visiblePolicies.find((policy) => policy.id === viewPolicyId) ?? null;
  const isFiltered = Boolean(
    search || typeFilter !== "All" || statusFilter !== "All" || premiumFilter !== "all",
  );

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("All");
    setStatusFilter("All");
    setPremiumFilter("all");
    setPage(1);
  };

  const showError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "Something went wrong.");

  const addPolicy = async (data: PolicyFormData) => {
    const draft = fromPolicyForm(data, { id: "", policiesSold: 0 });
    try {
      const created = await catalog.create(draft);
      setPage(1);
      setAddOpen(false);
      toast.success(`${created.name} added to the policy catalog.`);
    } catch (error) {
      showError(error);
    }
  };

  const updatePolicy = async (data: PolicyFormData) => {
    if (!editPolicy) return;
    try {
      const updated = await catalog.update(fromPolicyForm(data, editPolicy));
      setEditPolicy(null);
      toast.success(`${updated.name} updated.`);
    } catch (error) {
      showError(error);
    }
  };

  const duplicatePolicy = async (source: PolicyProduct) => {
    try {
      const copy = await catalog.duplicate(source);
      toast.success(`Duplicated as ${copy.code}. The copy is inactive until you review it.`);
    } catch (error) {
      showError(error);
    }
  };

  const toggleStatus = async (target: PolicyProduct) => {
    const status: PolicyProductStatus = target.status === "Active" ? "Inactive" : "Active";
    try {
      await catalog.setStatus(target, status);
      toast.success(
        status === "Active"
          ? `${target.name} is now available to agents.`
          : `${target.name} is now hidden from agents.`,
      );
    } catch (error) {
      showError(error);
    }
  };

  const confirmDelete = async () => {
    if (!deletePolicy) return;
    const target = deletePolicy;
    setDeletePolicy(null);
    try {
      await catalog.remove(target);
      if (viewPolicyId === target.id) setViewPolicyId(null);
      toast.success(`${target.name} was removed from the policy catalog.`);
    } catch (error) {
      showError(error);
    }
  };

  const openEdit = (policy: PolicyProduct) => {
    setViewPolicyId(null);
    setEditPolicy(policy);
  };

  const rowActions = (policy: PolicyProduct) => ({
    onView: () => setViewPolicyId(policy.id),
    onEdit: () => setEditPolicy(policy),
    onDuplicate: () => duplicatePolicy(policy),
    onToggleStatus: () => toggleStatus(policy),
    onDelete: () => setDeletePolicy(policy),
  });

  const filteredTotal = catalog.filteredTotal;
  const firstShown = filteredTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, filteredTotal);
  const tableNotice = catalog.error
    ? catalog.error
    : catalog.isLoading
      ? "Loading policies…"
      : "No policies match these filters.";

  return (
    <div className="min-h-screen bg-surface/30 text-foreground selection:bg-primary/20 selection:text-primary">
      <Toaster position="top-right" richColors />
      <AdminSidebar
        currentPath="/admin/policies"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-screen flex-col app-shell-pad">
        <AdminHeader onToggleSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                to="/admin/dashboard"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Back to Dashboard
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
                  Policy Management
                </h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Manage insurance products, plans, coverage and premiums
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search policies by name or code"
                  placeholder="Search name or code..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-xl bg-background pl-9 pr-8 text-xs sm:w-56"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Clear policy search"
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="h-9 rounded-xl text-xs"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add Policy</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>

          <PolicyKpiCards kpis={catalog.kpis} />

          <section
            aria-label="Policy filters"
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-xs"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Filter className="size-3.5 text-primary" /> Filters{" "}
                {isFiltered && (
                  <Badge variant="secondary" className="text-[10px]">
                    Active
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
                <SelectField
                  aria-label="Filter by insurance type"
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value as typeof typeFilter);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="All">Type: All</option>
                  <option value="Health">Health</option>
                  <option value="Motor">Motor</option>
                  <option value="Life">Life</option>
                  <option value="Commercial">Commercial</option>
                </SelectField>
                <SelectField
                  aria-label="Filter by policy status"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as typeof statusFilter);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  <option value="All">Status: All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </SelectField>
                <SelectField
                  aria-label="Filter by premium range"
                  value={premiumFilter}
                  onChange={(event) => {
                    setPremiumFilter(event.target.value);
                    setPage(1);
                  }}
                  className={selectClass}
                >
                  {premiumRanges.map((range) => (
                    <option key={range.id} value={range.id}>
                      {range.label}
                    </option>
                  ))}
                </SelectField>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  disabled={!isFiltered}
                  className="h-9 rounded-xl text-xs"
                >
                  <RotateCcw className="size-3.5" /> Reset filters
                </Button>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-background/90 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-display text-base font-bold">Policy Catalog</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredTotal} {filteredTotal === 1 ? "policy" : "policies"} found
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only active policies are offered to agents
              </p>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-surface/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pl-5 pr-4">Policy Code</th>
                    <th className="px-4 py-3">Policy Name</th>
                    <th className="px-4 py-3">Insurance Type</th>
                    <th className="px-4 py-3">Coverage</th>
                    <th className="px-4 py-3">Premium</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Policies Sold</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="py-3 pl-4 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {visiblePolicies.map((policy) => (
                    <tr
                      key={policy.id}
                      className={`transition-colors hover:bg-muted/40 ${
                        policy.status === "Inactive" ? "text-muted-foreground" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap py-3.5 pl-5 pr-4 font-mono text-[11px] font-semibold">
                        {policy.code}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setViewPolicyId(policy.id)}
                          className="text-left font-bold text-foreground hover:text-primary hover:underline"
                        >
                          {policy.name}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <PolicyTypeBadge type={policy.type} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold">
                        {formatINR(policy.coverageAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="font-semibold">{formatINR(policy.premium)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {policy.premiumFrequency}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {formatPolicyDuration(policy.durationMonths)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold">
                        {policy.policiesSold.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5">
                        <PolicyStatusBadge status={policy.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                        {formatUpdated(policy.lastUpdated)}
                      </td>
                      <td className="py-3.5 pl-4 pr-5">
                        <PolicyRowActions policy={policy} {...rowActions(policy)} />
                      </td>
                    </tr>
                  ))}
                  {visiblePolicies.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-14 text-center text-sm text-muted-foreground">
                        <Shield className="mx-auto mb-3 size-9 opacity-30" />
                        {tableNotice}
                        {catalog.error && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={catalog.retry}
                            className="ml-3 h-8 rounded-lg"
                          >
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border/60 md:hidden">
              {visiblePolicies.map((policy) => (
                <article key={policy.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold">{policy.name}</h3>
                      <p className="font-mono text-[11px] text-muted-foreground">{policy.code}</p>
                    </div>
                    <PolicyRowActions policy={policy} {...rowActions(policy)} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <PolicyTypeBadge type={policy.type} />
                    <PolicyStatusBadge status={policy.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Coverage</p>
                      <p className="mt-0.5 font-semibold">{formatINR(policy.coverageAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Premium</p>
                      <p className="mt-0.5 font-semibold">
                        {formatINR(policy.premium)}{" "}
                        <span className="font-normal text-muted-foreground">
                          / {policy.premiumFrequency.toLowerCase()}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="mt-0.5 font-medium">
                        {formatPolicyDuration(policy.durationMonths)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Policies sold</p>
                      <p className="mt-0.5 font-medium">
                        {policy.policiesSold.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Updated {formatUpdated(policy.lastUpdated)}
                  </p>
                </article>
              ))}
              {visiblePolicies.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {tableNotice}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs text-muted-foreground">
                Showing {firstShown}–{lastShown} of {filteredTotal} policies
              </p>
              <nav
                aria-label="Policy pagination"
                className="flex flex-wrap items-center justify-between gap-1 sm:justify-end"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                    <Button
                      key={number}
                      type="button"
                      variant={number === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPage(number)}
                      aria-current={number === currentPage ? "page" : undefined}
                      className="h-8 min-w-8 rounded-lg px-2"
                    >
                      {number}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="h-8 rounded-lg"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            </div>
          </section>

          <PolicyAnalytics salesByType={catalog.salesByType} topPolicies={catalog.topPolicies} />
        </main>
        <AdminFooter />
      </div>

      {addOpen && (
        <PolicyFormModal
          key="new-policy"
          mode="add"
          initial={emptyPolicyForm}
          existingCodes={catalog.existingCodes}
          onClose={() => setAddOpen(false)}
          onSubmit={addPolicy}
        />
      )}
      {editPolicy && (
        <PolicyFormModal
          key={editPolicy.id}
          mode="edit"
          initial={toPolicyForm(editPolicy)}
          existingCodes={catalog.existingCodes.filter((code) => code !== editPolicy.code)}
          onClose={() => setEditPolicy(null)}
          onSubmit={updatePolicy}
        />
      )}
      {viewPolicy && (
        <PolicyDetailsDialog
          policy={viewPolicy}
          onClose={() => setViewPolicyId(null)}
          onEdit={() => openEdit(viewPolicy)}
          onToggleStatus={() => toggleStatus(viewPolicy)}
        />
      )}
      <AlertDialog
        open={Boolean(deletePolicy)}
        onOpenChange={(open) => !open && setDeletePolicy(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deletePolicy?.name ?? "this policy"}
              {deletePolicy ? ` (${deletePolicy.code})` : ""} from the{" "}
              {catalog.source === "demo" ? "local " : ""}policy catalog. Policies already sold are
              not affected. To stop new sales without deleting, deactivate the policy instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

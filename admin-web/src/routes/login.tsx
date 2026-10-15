import { PUBLIC_SITE_URL } from "@/lib/site";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { AgentLoginForm } from "@/components/auth/AgentLoginForm";
import { adminPasswordLogin, getAdminSession } from "@/lib/admin-auth";
import { forgetAgentSignIn, hasAgentSignInHint } from "@/lib/agent-session";
import { currentUserKey } from "@/hooks/use-current-user";
import { adminAuthApi, agentAuthApi, ApiError, isApiConfigured, passwordResetApi } from "@/lib/api";

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>): { role?: "agent" | "admin" | undefined } => ({
    role: raw["role"] === "agent" ? "agent" : raw["role"] === "admin" ? "admin" : undefined,
  }),
  beforeLoad: async () => {
    if (await getAdminSession()) throw redirect({ to: "/admin/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Sign In — InsuroX Prime Portal" },
      {
        name: "description",
        content:
          "Secure role-based authentication portal for InsuroX administrators and Certified Agents.",
      },
      { property: "og:title", content: "Sign In — InsuroX Prime Portal" },
      {
        property: "og:description",
        content:
          "Secure role-based authentication portal for InsuroX administrators and Certified Agents.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LoginPage,
});

type Role = "super_admin" | "agent";

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const search = Route.useSearch();
  const [role, setRole] = useState<Role>(search.role === "agent" ? "agent" : "super_admin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");

  // Form errors
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ identifier?: boolean; password?: boolean }>({});

  // Forgot password modal
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  const isSuperAdmin = role === "super_admin";

  // The agent session is an HttpOnly cookie on the API; this hint only says one may exist.
  // The workspace verifies it with the server and comes back here if it has ended.
  useEffect(() => {
    if (hasAgentSignInHint()) void navigate({ to: "/agent/dashboard" });
  }, [navigate]);

  const validate = (field?: "identifier" | "password") => {
    const newErrors: { identifier?: string; password?: string } = { ...errors };

    if (!field || field === "identifier") {
      const trimmed = identifier.trim();
      if (!trimmed) {
        newErrors.identifier = isSuperAdmin
          ? "Please enter your Admin ID, phone or email."
          : "Please enter your Agent ID or registered email.";
      } else if (trimmed.includes("@")) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          newErrors.identifier = "Please enter a valid email address.";
        } else {
          delete newErrors.identifier;
        }
      } else if (trimmed.length < 3) {
        newErrors.identifier = "ID must be at least 3 characters long.";
      } else {
        delete newErrors.identifier;
      }
    }

    if (!field || field === "password") {
      if (!password) {
        newErrors.password = "Please enter your password.";
      } else if (password.length < 6) {
        newErrors.password = "Password must be at least 6 characters long.";
      } else {
        delete newErrors.password;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRoleChange = (newRole: Role) => {
    if (newRole === role) return;
    setRole(newRole);
    setErrors({});
    setTouched({});
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ identifier: true, password: true });
    if (!validate()) return;

    setSignInError("");
    setIsSigningIn(true);
    try {
      const credentials = { identifier: identifier.trim(), password };

      // 1) A tenant admin signs in with their email and password against the API.
      if (isApiConfigured && credentials.identifier.includes("@")) {
        try {
          const result = await agentAuthApi.login(credentials.identifier, credentials.password);
          if (result.user.role === "TENANT_ADMIN") {
            forgetAgentSignIn();
            queryClient.setQueryData(currentUserKey, result.user);
            toast.success(`Signed in to ${result.user.tenant?.name ?? "your agency"}.`);
            await navigate({
              to: result.user.mustChangePassword ? "/admin/change-password" : "/admin/dashboard",
            });
            return;
          }
          // An agent used the admin tab: the API session is theirs, so send them to their workspace.
          if (result.user.role === "AGENT") {
            toast.info("That is an agent account. Opening the agent workspace.");
            await navigate({ to: "/agent/dashboard" });
            return;
          }
        } catch (error) {
          // Only a wrong email/password falls through to the platform admin check below.
          if (!(error instanceof ApiError && error.code === "INVALID_CREDENTIALS")) throw error;
        }
      }

      // 2) The platform Super Admin: the fixed credentials from the server environment.
      await adminPasswordLogin({ data: credentials });
      forgetAgentSignIn();
      if (isApiConfigured) {
        const result = await adminAuthApi.login(credentials.identifier, credentials.password);
        queryClient.setQueryData(currentUserKey, result.user);
        toast.success("Signed in as Super Admin.");
        await navigate({ to: "/admin/tenants" });
        return;
      }
      toast.success("Signed in as Super Admin.");
      await navigate({ to: "/admin/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign-in failed. Please try again.";
      setSignInError(message);
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const [forgotSending, setForgotSending] = useState(false);
  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotSent(false);
    setForgotError("");
    if (!isApiConfigured) {
      setForgotError("Password recovery is unavailable because the API is not configured.");
      return;
    }
    setForgotSending(true);
    try {
      await passwordResetApi.request(forgotEmail.trim());
      setForgotSent(true);
    } catch (error) {
      setForgotError(
        error instanceof Error ? error.message : "Could not send the email. Please try again.",
      );
    } finally {
      setForgotSending(false);
    }
  };

  return (
    <div className="site-shell login-grid min-h-screen text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      <Toaster position="top-right" richColors />

      {/* Top Navigation Bar */}
      <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
        <nav
          aria-label="Login Header"
          className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border border-border/70 bg-background/80 px-4 shadow-nav backdrop-blur-xl sm:px-6"
        >
          <a
            href={PUBLIC_SITE_URL}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <img src="/insurox-icon.png" alt="" className="size-9 rounded-lg shadow-sm" />

            <span className="flex flex-col leading-none">
              <Brand className="font-display text-lg font-extrabold tracking-tight" />
              <span className="mt-1 text-[10px] font-medium tracking-wide text-foreground">
                A Vikaas Infina Product
              </span>
            </span>
          </a>
          <ThemeToggle />
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="relative flex flex-1 items-center justify-center px-4 pb-12 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <div className="relative z-10 mx-auto w-full max-w-[510px]">
          {/* Login Card */}
          <div className="w-full">
            <div className="relative mx-auto w-full rounded-3xl border border-border/60 bg-background/90 p-7 shadow-nav backdrop-blur-xl sm:p-9">
              {/* Header inside Card */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase text-muted-foreground mb-3">
                  <Sparkles className="size-3.5 text-signal" />
                  <span>Authorized Personnel Only</span>
                </div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Welcome Back
                </h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Pick your role to sign in to your InsuroX Prime workspace.
                </p>
              </div>

              {/* Role Selector Tabs */}
              <div className="mb-8">
                <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Access Level
                </label>
                <div
                  role="tablist"
                  aria-label="Authentication Role"
                  className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/60 p-1.5"
                >
                  <button
                    type="button"
                    role="tab"
                    id="role-super-admin"
                    aria-selected={isSuperAdmin}
                    onClick={() => handleRoleChange("super_admin")}
                    className={`relative flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      isSuperAdmin
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <span
                      className={`grid size-7 place-items-center rounded-lg transition-colors ${
                        isSuperAdmin
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Shield className="size-4" />
                    </span>
                    <span>Admin</span>
                    {isSuperAdmin && (
                      <span className="size-1.5 rounded-full bg-signal absolute right-3 top-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    id="role-agent"
                    aria-selected={!isSuperAdmin}
                    onClick={() => handleRoleChange("agent")}
                    className={`relative flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      !isSuperAdmin
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <span
                      className={`grid size-7 place-items-center rounded-lg transition-colors ${
                        !isSuperAdmin
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Users className="size-4" />
                    </span>
                    <span>Agent</span>
                    {!isSuperAdmin && (
                      <span className="size-1.5 rounded-full bg-signal absolute right-3 top-3" />
                    )}
                  </button>
                </div>
              </div>

              {!isSuperAdmin ? (
                <AgentLoginForm />
              ) : (
                <>
                  {/* Authentication Form */}
                  <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* ID / Email Field */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label
                          htmlFor="identifier"
                          className="text-xs font-bold uppercase tracking-wider text-foreground"
                        >
                          {isSuperAdmin ? "Admin ID / Email" : "Agent ID / Email"}
                        </Label>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                          {identifier.includes("@") ? (
                            <Mail className="size-4" />
                          ) : isSuperAdmin ? (
                            <Shield className="size-4" />
                          ) : (
                            <User className="size-4" />
                          )}
                        </div>
                        <Input
                          id="identifier"
                          name="identifier"
                          type="text"
                          autoComplete="username"
                          autoCapitalize="none"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (touched.identifier) validate("identifier");
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, identifier: true }));
                            validate("identifier");
                          }}
                          placeholder={
                            isSuperAdmin
                              ? "admin@insurex.com or Admin ID"
                              : "agent@insurex.com or Agent ID"
                          }
                          aria-invalid={Boolean(errors.identifier)}
                          aria-describedby={errors.identifier ? "identifier-error" : undefined}
                          className={`h-12 rounded-2xl border-blue-100 bg-blue-50/40 hover:bg-blue-50/70 focus:bg-background pl-10 pr-4 text-sm transition-all focus-visible:ring-2 ${
                            errors.identifier
                              ? "border-destructive focus-visible:ring-destructive/30"
                              : "border-input focus-visible:border-primary focus-visible:ring-primary/20"
                          }`}
                        />
                      </div>
                      {errors.identifier && (
                        <p
                          id="identifier-error"
                          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                        >
                          <ShieldAlert className="size-3.5 shrink-0" />
                          <span>{errors.identifier}</span>
                        </p>
                      )}
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label
                          htmlFor="password"
                          className="text-xs font-bold uppercase tracking-wider text-foreground"
                        >
                          Password
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotSent(false);
                            setForgotEmail(identifier.trim());
                            setForgotPasswordOpen(true);
                          }}
                          className="text-xs font-semibold text-primary transition-colors hover:text-primary/80 hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                          <Lock className="size-4" />
                        </div>
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (touched.password) validate("password");
                          }}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, password: true }));
                            validate("password");
                          }}
                          placeholder="••••••••••••"
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "password-error" : undefined}
                          className={`h-12 rounded-2xl border-blue-100 bg-blue-50/40 hover:bg-blue-50/70 focus:bg-background pl-10 pr-11 text-sm transition-all focus-visible:ring-2 ${
                            errors.password
                              ? "border-destructive focus-visible:ring-destructive/30"
                              : "border-input focus-visible:border-primary focus-visible:ring-primary/20"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p
                          id="password-error"
                          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                        >
                          <ShieldAlert className="size-3.5 shrink-0" />
                          <span>{errors.password}</span>
                        </p>
                      )}
                    </div>

                    {/* Submit Login Button */}
                    <div className="pt-2">
                      {signInError && (
                        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <ShieldAlert className="size-3.5 shrink-0" />
                          <span>{signInError}</span>
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={isSigningIn}
                        className="h-12 w-full rounded-2xl font-semibold shadow-lg shadow-primary/30"
                      >
                        {isSigningIn ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                        <span>{isSigningIn ? "Signing in..." : "Sign in as Admin"}</span>
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-6 py-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p>© 2026 Vikaas Infina Technologies Pvt Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs">
            <a href={PUBLIC_SITE_URL} className="hover:text-foreground transition-colors">
              Public Homepage
            </a>
          </div>
        </div>
      </footer>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Enter your registered email or Agent ID. We will email you a reset link and a
              temporary password.
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-signal/20 text-foreground">
                <CheckCircle2 className="size-6 text-foreground" />
              </div>
              <h4 className="font-bold text-foreground">Check your email</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{forgotEmail}</span>, you will receive
                an email shortly with a reset link and a temporary password. The link expires in 30
                minutes.
              </p>
              <div className="mt-5">
                <Button
                  type="button"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="rounded-full bg-primary text-primary-foreground px-6"
                >
                  Return to Login
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-2">
              <div>
                <Label
                  htmlFor="forgot-email"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Registered Email or Agent ID
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="text"
                    autoComplete="username"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Email or Agent ID"
                    className="pl-9 h-11 rounded-xl"
                    required
                  />
                </div>
                {forgotError && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <ShieldAlert className="size-3" /> {forgotError}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-xl">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={forgotSending}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  {forgotSending ? "Sending…" : "Send Recovery Link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

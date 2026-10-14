import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LEGAL_UPDATED } from "@/lib/site";

/** Shell for the Privacy Policy and Terms pages: brand header, readable column, footer links. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 lg:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            InsuroX
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
        </div>
      </header>

      <main className="px-6 py-12 lg:px-10">
        <article className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>
          <div className="mt-10 space-y-8 text-[15px] leading-7 text-foreground/90 [&_a]:underline [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-border px-6 py-6 text-xs text-muted-foreground lg:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-between">
          <p>© 2026 InsuroX. All rights reserved.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

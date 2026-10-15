import { Brand } from "@/components/Brand";
import { cn } from "@/lib/utils";

interface AppFooterProps {
  /** Signed-in tenant's name; falls back to the platform name when there is none. */
  tenantName?: string | null | undefined;
  className?: string;
}

export function AppFooter({ tenantName, className }: AppFooterProps) {
  return (
    <footer
      className={cn(
        "flex flex-col items-center justify-between gap-1 border-t border-border/80 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:px-6 lg:px-8",
        className,
      )}
    >
      <p>© 2026 {tenantName ?? <Brand />}. All rights reserved.</p>
      <p>
        <Brand /> • Powered by{" "}
        <a
          href="https://vikaasinfina.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          Vikaas Infina
        </a>
      </p>
    </footer>
  );
}

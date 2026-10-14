import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { googleCalendarApi, isApiConfigured, retryUnlessClientError } from "@/lib/api";
import type { CalendarScope } from "./use-calendar-data";

const outcomes: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google Calendar connected. Syncing your meetings…" },
  denied: { ok: false, text: "Google Calendar wasn't connected (access was not granted)." },
  failed: { ok: false, text: "Couldn't connect Google Calendar. Please try again." },
};

/** Link / sync / unlink the signed-in user's Google Calendar. Hidden when the server has no Google setup. */
export function GoogleCalendarSync({ scope }: { scope: CalendarScope }) {
  const queryClient = useQueryClient();
  const statusKey = [scope, "google-calendar"] as const;
  const status = useQuery({
    queryKey: statusKey,
    queryFn: googleCalendarApi.status,
    enabled: isApiConfigured,
    retry: retryUnlessClientError,
    staleTime: 60_000,
  });

  const refreshMeetings = () => queryClient.invalidateQueries({ queryKey: [scope, "meetings"] });

  const connect = useMutation({
    mutationFn: googleCalendarApi.connect,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't start Google sign-in."),
  });
  const sync = useMutation({
    mutationFn: googleCalendarApi.sync,
    onSuccess: (next) => {
      queryClient.setQueryData(statusKey, next);
      void refreshMeetings();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Google sync failed."),
  });
  const disconnect = useMutation({
    mutationFn: googleCalendarApi.disconnect,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: statusKey });
      toast.success("Google Calendar disconnected. Events already on Google stay there.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Couldn't disconnect."),
  });

  // Coming back from Google's consent screen: report the result once, then tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = outcomes[params.get("google") ?? ""];
    if (!outcome) return;
    (outcome.ok ? toast.success : toast.error)(outcome.text);
    params.delete("google");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    void queryClient.invalidateQueries({ queryKey: statusKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up changes made in Google each time the calendar is opened.
  const autoSynced = useRef(false);
  useEffect(() => {
    if (status.data?.connected && !autoSynced.current) {
      autoSynced.current = true;
      sync.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data?.connected]);

  if (!status.data?.configured) return null;

  if (!status.data.connected) {
    return (
      <Button
        variant="outline"
        className="rounded-xl"
        disabled={connect.isPending}
        onClick={() => connect.mutate()}
      >
        {connect.isPending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <CalendarSync className="mr-1.5 size-4" />
        )}
        Connect Google Calendar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="hidden max-w-[14rem] truncate text-xs text-muted-foreground xl:inline"
        title={status.data.lastError ?? undefined}
      >
        {status.data.lastError
          ? "Google sync problem"
          : `Synced with ${status.data.googleEmail || "Google"}`}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={sync.isPending}
        onClick={() => sync.mutate()}
      >
        <RefreshCw className={`mr-1.5 size-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
        Sync Google
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Disconnect Google Calendar"
        title="Disconnect Google Calendar"
        disabled={disconnect.isPending}
        onClick={() => disconnect.mutate()}
      >
        <Link2Off className="size-4" />
      </Button>
    </div>
  );
}

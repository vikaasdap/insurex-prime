import { X } from "lucide-react";

/** Title row of the bell menu: unread count plus "Mark all read" and "Clear all". */
export function NotificationsHeader({
  unread,
  hasItems,
  onMarkAllRead,
  onClearAll,
}: {
  unread: number;
  hasItems: boolean;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">Notifications</span>
        {unread > 0 && (
          <span className="rounded-full bg-signal/20 px-2 py-0.5 text-[10px] font-bold text-foreground">
            {unread} new
          </span>
        )}
      </div>
      {hasItems && (
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClearAll}
            className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

/** Small ✕ on a notification row. */
export function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss notification"
      className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <X className="size-3.5" />
    </button>
  );
}

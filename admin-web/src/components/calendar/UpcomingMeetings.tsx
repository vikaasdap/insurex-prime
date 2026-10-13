import { Link } from "@tanstack/react-router";
import { ExternalLink, Video } from "lucide-react";
import { useMemo } from "react";
import { isApiConfigured } from "@/lib/api";
import { addDays, formatDay, formatTime, isSameDay, startOfDay } from "./calendar-utils";
import { useMeetings, type CalendarScope } from "./use-calendar-data";

const SHOWN = 5;

/** Meetings still to come (or in progress) over the next week, soonest first. */
export function useUpcomingMeetings(scope: CalendarScope) {
  const { from, to } = useMemo(() => {
    const today = startOfDay(new Date());
    return { from: today, to: addDays(today, 8) };
  }, []);
  const query = useMeetings(scope, from, to);
  const now = Date.now();
  const upcoming = (query.data ?? []).filter((meeting) => new Date(meeting.endsAt).getTime() > now);
  return { ...query, upcoming: upcoming.slice(0, SHOWN), total: upcoming.length };
}

const dayLabel = (date: Date) => {
  const now = new Date();
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, addDays(now, 1))) return "Tomorrow";
  return formatDay(date, { weekday: "short", day: "numeric", month: "short" });
};

/** The "meetings" part of the bell menu: the same meetings the phone alerts are about. */
export function UpcomingMeetingsList({
  scope,
  meetings,
}: {
  scope: CalendarScope;
  meetings: ReturnType<typeof useUpcomingMeetings>["upcoming"];
}) {
  if (!isApiConfigured) return null;
  return (
    <>
      {meetings.map((meeting) => {
        const startsAt = new Date(meeting.startsAt);
        const withWhom =
          meeting.canEdit && meeting.attendees.length > 0
            ? `${meeting.attendees.length} invited`
            : `with ${meeting.organizer.name}`;
        return (
          <div
            key={meeting.id}
            className="flex gap-3 p-3 text-xs transition-colors hover:bg-muted/40"
          >
            <Video className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <Link
                to={scope === "agent" ? "/agent/calendar" : "/admin/calendar"}
                className="block truncate font-semibold text-foreground"
              >
                {meeting.title}
              </Link>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {dayLabel(startsAt)}, {formatTime(startsAt)} · {withWhom}
              </p>
              {meeting.meetingUrl && (
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
                >
                  Join <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

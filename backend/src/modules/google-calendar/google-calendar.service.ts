import type { FastifyBaseLogger } from "fastify";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { badRequest } from "../../utils/errors.js";
import { reminderFlagsFor } from "../meetings/meeting-push.js";
import {
  GoogleApiError,
  accessTokenFor,
  buildConsentUrl,
  deleteEvent,
  exchangeCode,
  googleConfig,
  insertEvent,
  listEvents,
  patchEvent,
  revokeToken,
  type GoogleConfig,
  type GoogleEvent,
  type GoogleEventInput,
} from "./google-api.js";
import { decryptToken, encryptToken, signState, verifyState } from "./google-crypto.js";

/** How far back the first read of a Google calendar goes. */
const INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60_000;
/** How far ahead Google events are imported (a repeating event has no end). */
const IMPORT_HORIZON_MS = 90 * 24 * 60 * 60_000;
const MAX_PAGES = 10;
const JOIN_LINE = /\n*Join: \S+\s*$/;

export const isGoogleConfigured = (env: Env) => googleConfig(env) !== null;

type Ctx = { db: Database; env: Env; logger: FastifyBaseLogger };

const requireConfig = (env: Env) => {
  const config = googleConfig(env);
  if (!config) throw badRequest("Google Calendar sync is not set up on this server.");
  return config;
};

// ─── connect / disconnect ─────────────────────────────────────────────────────

export async function getStatus(db: Database, env: Env, userId: string) {
  const connection = await db.googleCalendarConnection.findUnique({ where: { userId } });
  return {
    configured: isGoogleConfigured(env),
    connected: Boolean(connection),
    googleEmail: connection?.googleEmail ?? null,
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
    lastError: connection?.lastError ?? null,
  };
}

export async function startConnect(env: Env, userId: string, email: string) {
  const config = requireConfig(env);
  return { url: buildConsentUrl(config, signState(userId, config.tokenSecret), email) };
}

/** Finishes the consent flow; returns the portal path to send the user back to. */
export async function completeConnect(ctx: Ctx, code: string, state: string) {
  const config = requireConfig(ctx.env);
  const userId = verifyState(state, config.tokenSecret);
  if (!userId) throw badRequest("This Google sign-in link has expired. Please try connecting again.");
  const user = await ctx.db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw badRequest("Account not found.");

  const tokens = await exchangeCode(config, code);
  if (!tokens.hasCalendarAccess) {
    throw badRequest("Calendar access wasn't granted. Connect again and tick the permission to see and edit events.");
  }
  if (!tokens.refreshToken) {
    throw badRequest("Google did not grant offline access. Remove InsuroX from your Google account's third-party access and try again.");
  }
  const refreshTokenEnc = encryptToken(tokens.refreshToken, config.tokenSecret);
  await ctx.db.googleCalendarConnection.upsert({
    where: { userId },
    create: { userId, googleEmail: tokens.email, refreshTokenEnc },
    // A new account (or token) starts from a full read.
    update: { googleEmail: tokens.email, refreshTokenEnc, syncToken: null, lastError: null },
  });
  // Mappings from a previously linked account would point at events that are not in this calendar.
  await ctx.db.meetingGoogleEvent.deleteMany({ where: { userId } });
  void syncUser(ctx, userId).catch((error) => ctx.logger.error({ err: error }, "first Google sync failed"));
  return user.role === "AGENT" ? "/agent/calendar" : "/admin/calendar";
}

export async function disconnect(db: Database, env: Env, userId: string) {
  const config = googleConfig(env);
  const connection = await db.googleCalendarConnection.findUnique({ where: { userId } });
  if (connection && config) {
    await revokeToken(decryptToken(connection.refreshTokenEnc, config.tokenSecret));
  }
  await db.googleCalendarConnection.deleteMany({ where: { userId } });
  // Events already on their Google calendar stay; we just stop tracking them.
  await db.meetingGoogleEvent.deleteMany({ where: { userId } });
  return { connected: false };
}

// ─── building events ──────────────────────────────────────────────────────────

interface MeetingForGoogle {
  id: string;
  title: string;
  description: string;
  meetingUrl: string;
  startsAt: Date;
  endsAt: Date;
}

function toGoogleEvent(meeting: MeetingForGoogle): GoogleEventInput {
  const description = [meeting.description.trim(), meeting.meetingUrl ? `Join: ${meeting.meetingUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    summary: meeting.title,
    description,
    start: { dateTime: meeting.startsAt.toISOString() },
    end: { dateTime: meeting.endsAt.toISOString() },
    ...(meeting.meetingUrl ? { source: { title: "Join meeting", url: meeting.meetingUrl } } : {}),
    extendedProperties: { private: { insuroxMeetingId: meeting.id } },
  };
}

// ─── app → Google ─────────────────────────────────────────────────────────────

type Connection = { userId: string; refreshTokenEnc: string };

async function tokenFor(ctx: Ctx, config: GoogleConfig, connection: Connection) {
  try {
    return await accessTokenFor(config, decryptToken(connection.refreshTokenEnc, config.tokenSecret));
  } catch (error) {
    if (error instanceof GoogleApiError && error.reason === "invalid_grant") {
      // The user revoked access in their Google account.
      await ctx.db.googleCalendarConnection.deleteMany({ where: { userId: connection.userId } });
      await ctx.db.meetingGoogleEvent.deleteMany({ where: { userId: connection.userId } });
    }
    throw error;
  }
}

const isGone = (error: unknown) => error instanceof GoogleApiError && (error.status === 404 || error.status === 410);

/**
 * Writes the meeting to the Google calendar of everyone connected who is part of it, and
 * removes it from people who no longer are. Never throws: a Google outage must not block saving.
 */
export async function pushMeeting(ctx: Ctx, meetingId: string, onlyUserId?: string) {
  const config = googleConfig(ctx.env);
  if (!config) return;
  try {
    const meeting = await ctx.db.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: { select: { userId: true } }, googleEvents: true },
    });
    if (!meeting) return;
    const members = new Set([meeting.organizerId, ...meeting.attendees.map((a) => a.userId)]);
    const mappedUserIds = meeting.googleEvents.map((mapping) => mapping.userId);
    const connections = await ctx.db.googleCalendarConnection.findMany({
      where: { userId: { in: [...new Set([...members, ...mappedUserIds])] } },
    });
    for (const connection of connections) {
      if (onlyUserId && connection.userId !== onlyUserId) continue;
      const mapping = meeting.googleEvents.find((m) => m.userId === connection.userId);
      try {
        const token = await tokenFor(ctx, config, connection);
        if (!members.has(connection.userId)) {
          if (mapping) {
            await deleteEvent(token, mapping.googleEventId).catch((e) => {
              if (!isGone(e)) throw e;
            });
            await ctx.db.meetingGoogleEvent.deleteMany({ where: { meetingId, userId: connection.userId } });
          }
          continue;
        }
        const body = toGoogleEvent(meeting);
        let written: GoogleEvent;
        if (mapping) {
          written = await patchEvent(token, mapping.googleEventId, body).catch((e) => {
            if (!isGone(e)) throw e;
            return insertEvent(token, body); // They deleted it on Google's side; put it back.
          });
        } else {
          written = await insertEvent(token, body);
        }
        await ctx.db.meetingGoogleEvent.upsert({
          where: { meetingId_userId: { meetingId, userId: connection.userId } },
          create: { meetingId, userId: connection.userId, googleEventId: written.id, etag: written.etag },
          update: { googleEventId: written.id, etag: written.etag },
        });
      } catch (error) {
        ctx.logger.warn({ err: error, meetingId, userId: connection.userId }, "Google Calendar push failed");
      }
    }
  } catch (error) {
    ctx.logger.warn({ err: error, meetingId }, "Google Calendar push failed");
  }
}

/** Removes a meeting's events from Google. Call before deleting the meeting row. Never throws. */
export async function removeMeeting(ctx: Ctx, meetingId: string) {
  const config = googleConfig(ctx.env);
  if (!config) return;
  try {
    const mappings = await ctx.db.meetingGoogleEvent.findMany({ where: { meetingId } });
    if (mappings.length === 0) return;
    const connections = await ctx.db.googleCalendarConnection.findMany({
      where: { userId: { in: mappings.map((m) => m.userId) } },
    });
    for (const connection of connections) {
      const mapping = mappings.find((m) => m.userId === connection.userId);
      if (!mapping) continue;
      try {
        const token = await tokenFor(ctx, config, connection);
        await deleteEvent(token, mapping.googleEventId).catch((e) => {
          if (!isGone(e)) throw e;
        });
      } catch (error) {
        ctx.logger.warn({ err: error, meetingId, userId: connection.userId }, "Google Calendar delete failed");
      }
    }
  } catch (error) {
    ctx.logger.warn({ err: error, meetingId }, "Google Calendar delete failed");
  }
}

// ─── Google → app ─────────────────────────────────────────────────────────────

const syncing = new Set<string>();

function readEvent(event: GoogleEvent) {
  const startIso = event.start?.dateTime;
  const endIso = event.end?.dateTime;
  if (!startIso || !endIso) return null; // all-day events have no clock time
  const startsAt = new Date(startIso);
  const endsAt = new Date(endIso);
  if (!(endsAt > startsAt)) return null;
  return {
    title: (event.summary ?? "").trim().slice(0, 200) || "(No title)",
    description: (event.description ?? "").replace(JOIN_LINE, "").trim().slice(0, 5000),
    meetingUrl: event.hangoutLink ?? event.source?.url ?? "",
    startsAt,
    endsAt,
  };
}

async function applyEvent(ctx: Ctx, userId: string, tenantId: string | null, event: GoogleEvent) {
  const { db } = ctx;
  const cancelled = event.status === "cancelled";
  const mapping = await db.meetingGoogleEvent.findUnique({
    where: { userId_googleEventId: { userId, googleEventId: event.id } },
    include: { meeting: { select: { id: true, organizerId: true, startsAt: true, meetingUrl: true } } },
  });

  if (mapping) {
    const isOrganizer = mapping.meeting.organizerId === userId;
    if (cancelled) {
      if (isOrganizer) await db.meeting.delete({ where: { id: mapping.meetingId } });
      else await db.meetingGoogleEvent.deleteMany({ where: { meetingId: mapping.meetingId, userId } });
      return;
    }
    if (event.etag === mapping.etag) return; // our own write
    const fields = readEvent(event);
    if (isOrganizer && fields) {
      const moved = fields.startsAt.getTime() !== mapping.meeting.startsAt.getTime();
      await db.meeting.update({
        where: { id: mapping.meetingId },
        data: {
          title: fields.title,
          description: fields.description,
          // Keep the link we have if Google's copy carries none.
          meetingUrl: fields.meetingUrl || mapping.meeting.meetingUrl,
          startsAt: fields.startsAt,
          endsAt: fields.endsAt,
          ...(moved ? reminderFlagsFor(fields.startsAt) : {}),
        },
      });
    }
    await db.meetingGoogleEvent.update({
      where: { meetingId_userId: { meetingId: mapping.meetingId, userId } },
      data: { etag: event.etag },
    });
    return;
  }

  if (cancelled) return;

  // An event we created earlier whose mapping was lost (e.g. reconnecting the same account).
  const ownId = event.extendedProperties?.private?.insuroxMeetingId;
  if (ownId) {
    const meeting = await db.meeting.findFirst({
      where: { id: ownId, OR: [{ organizerId: userId }, { attendees: { some: { userId } } }] },
      select: { id: true },
    });
    if (meeting) {
      await db.meetingGoogleEvent.upsert({
        where: { meetingId_userId: { meetingId: meeting.id, userId } },
        create: { meetingId: meeting.id, userId, googleEventId: event.id, etag: "" },
        update: { googleEventId: event.id, etag: "" },
      });
    }
    return;
  }

  // A new event made in Google Calendar becomes the user's own meeting.
  const fields = readEvent(event);
  if (!fields || !tenantId) return;
  const now = new Date();
  if (fields.startsAt.getTime() > now.getTime() + IMPORT_HORIZON_MS) return;
  await db.meeting.create({
    data: {
      tenantId,
      organizerId: userId,
      ...fields,
      // Google already reminds them; skip our own alerts for imported events.
      pushedTwoHoursAt: now,
      pushedFifteenMinAt: now,
      googleEvents: { create: { userId, googleEventId: event.id, etag: event.etag } },
    },
  });
}

async function pullChanges(ctx: Ctx, connection: Connection & { syncToken: string | null }, token: string) {
  const user = await ctx.db.user.findUnique({ where: { id: connection.userId }, select: { tenantId: true } });
  const timeMin = new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString();
  const timeMax = new Date(Date.now() + IMPORT_HORIZON_MS).toISOString();
  let syncToken: string | null = connection.syncToken;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await listEvents(token, { syncToken, timeMin, timeMax, ...(pageToken ? { pageToken } : {}) });
        for (const event of result.items) {
          try {
            await applyEvent(ctx, connection.userId, user?.tenantId ?? null, event);
          } catch (error) {
            ctx.logger.warn({ err: error, eventId: event.id }, "could not apply Google event");
          }
        }
        if (result.nextSyncToken) return result.nextSyncToken;
        pageToken = result.nextPageToken;
        if (!pageToken) return syncToken;
      }
      return syncToken; // too many pages: resume from the same cursor next time
    } catch (error) {
      // 410: the sync token expired. Start over with a full read.
      if (error instanceof GoogleApiError && error.status === 410 && syncToken) {
        syncToken = null;
        continue;
      }
      throw error;
    }
  }
  return syncToken;
}

/** Pulls Google-side changes, then pushes upcoming meetings that are not on Google yet. */
export async function syncUser(ctx: Ctx, userId: string) {
  const config = requireConfig(ctx.env);
  if (syncing.has(userId)) return;
  syncing.add(userId);
  try {
    const connection = await ctx.db.googleCalendarConnection.findUnique({ where: { userId } });
    if (!connection) return;
    try {
      const token = await tokenFor(ctx, config, connection);
      const syncToken = await pullChanges(ctx, connection, token);

      const missing = await ctx.db.meeting.findMany({
        where: {
          startsAt: { gte: new Date() },
          OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
          googleEvents: { none: { userId } },
        },
        select: { id: true },
        take: 200,
      });
      for (const { id } of missing) await pushMeeting(ctx, id, userId);

      await ctx.db.googleCalendarConnection.update({
        where: { userId },
        data: { syncToken, lastSyncedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "Sync failed";
      await ctx.db.googleCalendarConnection.updateMany({ where: { userId }, data: { lastError: message } });
      throw error;
    }
  } finally {
    syncing.delete(userId);
  }
}

/** A sync the user asked for: Google failures become messages they can act on. */
export async function syncUserNow(ctx: Ctx, userId: string) {
  try {
    await syncUser(ctx, userId);
  } catch (error) {
    if (!(error instanceof GoogleApiError)) throw error;
    if (error.reason === "invalid_grant") {
      throw badRequest("Google access was removed. Please connect Google Calendar again.");
    }
    if (error.reason === "accessNotConfigured" || /has not been used|is disabled/i.test(error.message)) {
      throw badRequest(
        "The Google Calendar API is not enabled for this app's Google Cloud project. Enable it in Google Cloud (APIs & Services > Library > Google Calendar API), wait a minute, then sync again.",
      );
    }
    if (error.reason === "insufficientPermissions" || /insufficient authentication scopes/i.test(error.message)) {
      throw badRequest("Google Calendar permission is missing. Disconnect, then connect again and allow calendar access.");
    }
    throw badRequest(`Google Calendar sync failed: ${error.message}`);
  }
}

export async function syncAll(ctx: Ctx) {
  const connections = await ctx.db.googleCalendarConnection.findMany({ select: { userId: true } });
  for (const { userId } of connections) {
    await syncUser(ctx, userId).catch((error) =>
      ctx.logger.warn({ err: error, userId }, "Google Calendar sync failed"),
    );
  }
}

/** Pulls every connected calendar every few minutes until `stop()` is called. */
export function startGoogleSyncJob(db: Database, env: Env, logger: FastifyBaseLogger) {
  if (!isGoogleConfigured(env) || env.GOOGLE_SYNC_INTERVAL_MINUTES === 0) return () => undefined;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    syncAll({ db, env, logger })
      .catch((error) => logger.error({ err: error }, "Google sync job failed"))
      .finally(() => {
        running = false;
      });
  }, env.GOOGLE_SYNC_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

import type { Env } from "../../config/env.js";

const CALENDAR = "https://www.googleapis.com/calendar/v3";
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenSecret: string;
}

/** The Google settings, or null when sync is not configured. */
export function googleConfig(env: Env): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI || !env.GOOGLE_TOKEN_SECRET) {
    return null;
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    tokenSecret: env.GOOGLE_TOKEN_SECRET,
  };
}

export function buildConsentUrl(config: GoogleConfig, state: string, loginHint?: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // Forces a refresh token even when the user has consented before.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
}

async function parseError(response: Response): Promise<GoogleApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string | { message?: string; errors?: { reason?: string }[] };
    error_description?: string;
  };
  const reason =
    typeof body.error === "string" ? body.error : (body.error?.errors?.[0]?.reason ?? "unknown");
  const message =
    body.error_description ?? (typeof body.error === "object" ? body.error?.message : body.error) ?? response.statusText;
  return new GoogleApiError(response.status, reason, message ?? "Google request failed");
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
}

export async function exchangeCode(config: GoogleConfig, code: string) {
  const tokens = await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  let email = "";
  if (tokens.id_token) {
    try {
      const claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
        email?: string;
      };
      email = claims.email ?? "";
    } catch {
      // The email is only a label; carry on without it.
    }
  }
  const granted = (tokens.scope ?? "").split(" ");
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    email,
    // Google lets people untick individual permissions on the consent screen.
    hasCalendarAccess: granted.includes(GOOGLE_SCOPES[0]!),
  };
}

const accessCache = new Map<string, { token: string; expiresAt: number }>();

/** A valid access token for the refresh token, cached until shortly before it expires. */
export async function accessTokenFor(config: GoogleConfig, refreshToken: string) {
  const cached = accessCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const tokens = await tokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  accessCache.set(refreshToken, { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
  return tokens.access_token;
}

export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

export interface GoogleEvent {
  id: string;
  etag: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  hangoutLink?: string;
  source?: { url?: string; title?: string };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export type GoogleEventInput = Omit<GoogleEvent, "id" | "etag" | "status" | "hangoutLink">;

async function calendarRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CALENDAR}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw await parseError(response);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const primary = "/calendars/primary/events";

export const insertEvent = (token: string, event: GoogleEventInput) =>
  calendarRequest<GoogleEvent>(token, primary, { method: "POST", body: JSON.stringify(event) });

export const patchEvent = (token: string, id: string, event: GoogleEventInput) =>
  calendarRequest<GoogleEvent>(token, `${primary}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });

export const deleteEvent = (token: string, id: string) =>
  calendarRequest<void>(token, `${primary}/${encodeURIComponent(id)}?sendUpdates=none`, { method: "DELETE" });

export interface EventPage {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/** One page of events. Pass `syncToken` for changes since last time; otherwise `timeMin` bounds a full read. */
export function listEvents(token: string, opts: { syncToken?: string | null; timeMin: string; timeMax: string; pageToken?: string }) {
  const params = new URLSearchParams({ singleEvents: "true", maxResults: "250", showDeleted: "true" });
  // timeMin/timeMax cannot be combined with a syncToken.
  if (opts.syncToken) params.set("syncToken", opts.syncToken);
  else {
    params.set("timeMin", opts.timeMin);
    params.set("timeMax", opts.timeMax);
  }
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return calendarRequest<EventPage>(token, `${primary}?${params.toString()}`);
}

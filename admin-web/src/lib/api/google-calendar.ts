import { apiRequest } from "./client";

export interface GoogleCalendarStatus {
  /** False when the server has no Google credentials. */
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export const googleCalendarApi = {
  status: () => apiRequest<GoogleCalendarStatus>("/integrations/google/status"),
  /** The Google consent URL to send the browser to. */
  connect: () => apiRequest<{ url: string }>("/integrations/google/connect", { method: "POST" }),
  sync: () => apiRequest<GoogleCalendarStatus>("/integrations/google/sync", { method: "POST" }),
  disconnect: () => apiRequest<{ connected: false }>("/integrations/google", { method: "DELETE" }),
};

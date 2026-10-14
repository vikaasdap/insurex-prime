import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/role.js";
import { errorResponses, ok, successSchema } from "../../utils/response.js";
import { completeConnect, disconnect, getStatus, startConnect, syncUserNow } from "./google-calendar.service.js";

const security = [{ bearerAuth: [] }];
const tags = ["Google Calendar"];

const statusSchema = z.object({
  configured: z.boolean().describe("False when the server has no Google credentials"),
  connected: z.boolean(),
  googleEmail: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

/** Two-way sync between meetings and the signed-in user's Google Calendar. */
export const googleCalendarRoutes: FastifyPluginAsyncZod = async (app) => {
  const ctx = (request: { log: typeof app.log }) => ({ db: app.db, env: app.config, logger: request.log });

  // Google sends the browser here after consent, so it cannot carry our auth header.
  app.get(
    "/callback",
    {
      schema: {
        tags,
        summary: "OAuth redirect target: stores the Google connection, then returns to the calendar",
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query;
      const origin = app.config.FRONTEND_URL.find((url) => url !== "*") ?? "";
      let path = "/agent/calendar";
      let outcome = "connected";
      if (error || !code || !state) {
        outcome = "denied";
      } else {
        try {
          path = await completeConnect(ctx(request), code, state);
        } catch (err) {
          request.log.warn({ err }, "Google Calendar connect failed");
          outcome = "failed";
        }
      }
      return reply.redirect(`${origin}${path}?google=${outcome}`);
    },
  );

  await app.register(async (authed) => {
    authed.addHook("onRequest", app.authenticate);
    authed.addHook("preHandler", requireRole("SUPER_ADMIN", "TENANT_ADMIN", "AGENT"));

    authed.get(
      "/status",
      {
        schema: {
          tags,
          security,
          summary: "Whether the signed-in user has linked a Google Calendar",
          response: { 200: successSchema(statusSchema), ...errorResponses },
        },
      },
      async (request) => ok(await getStatus(app.db, app.config, requireAuth(request).userId)),
    );

    authed.post(
      "/connect",
      {
        schema: {
          tags,
          security,
          summary: "Start linking: returns the Google consent URL to send the browser to",
          response: { 200: successSchema(z.object({ url: z.url() })), ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        return ok(await startConnect(app.config, auth.userId, auth.email));
      },
    );

    authed.post(
      "/sync",
      {
        schema: {
          tags,
          security,
          summary: "Sync now: pull changes from Google and push meetings that are not there yet",
          response: { 200: successSchema(statusSchema), ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        const status = await getStatus(app.db, app.config, auth.userId);
        if (status.connected) await syncUserNow(ctx(request), auth.userId);
        return ok(await getStatus(app.db, app.config, auth.userId));
      },
    );

    authed.delete(
      "",
      {
        schema: {
          tags,
          security,
          summary: "Unlink Google Calendar (events already on Google stay)",
          response: { 200: successSchema(z.object({ connected: z.literal(false) })), ...errorResponses },
        },
      },
      async (request) => ok(await disconnect(app.db, app.config, requireAuth(request).userId)),
    );
  });
};

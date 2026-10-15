import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireRole } from "../../middleware/role.js";
import { errorResponses, ok, successSchema } from "../../utils/response.js";
import {
  createMasterCategory,
  createMasterPolicies,
  deleteMasterCategory,
  deleteMasterPolicy,
  getMasterCatalog,
  syncMasterToTenants,
} from "./master-catalog.service.js";
import {
  createMasterCategoryBodySchema,
  createMasterPoliciesBodySchema,
  masterCatalogSchema,
  masterIdParamsSchema,
  masterInsurerParamsSchema,
  masterSyncResultSchema,
} from "./master-catalog.schemas.js";

const security = [{ bearerAuth: [] }];
const tags = ["Platform: Master catalog"];

/**
 * The platform's master catalog of every insurer's categories and policies. New agencies start
 * from it; "sync" adds new entries to agencies that already exist. SUPER_ADMIN only.
 */
export const masterCatalogRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);
  app.addHook("preHandler", requireRole("SUPER_ADMIN"));

  app.get(
    "",
    {
      schema: {
        tags,
        security,
        summary: "Every insurer's master catalog (SUPER_ADMIN)",
        response: { 200: successSchema(masterCatalogSchema), ...errorResponses },
      },
    },
    async () => ok(await getMasterCatalog(app.db)),
  );

  app.post(
    "/categories",
    {
      schema: {
        tags,
        security,
        summary: "Add a category or sub-category to an insurer's master catalog",
        body: createMasterCategoryBodySchema,
        response: {
          201: successSchema(z.object({ id: z.uuid(), name: z.string() })),
          ...errorResponses,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(ok(await createMasterCategory(app.db, request, request.body))),
  );

  app.post(
    "/policies",
    {
      schema: {
        tags,
        security,
        summary: "Add several policies to a master category (or directly to a line)",
        description:
          "The policy code is made from the name when left blank. Agencies pick these up at onboarding, or when you sync.",
        body: createMasterPoliciesBodySchema,
        response: { 201: successSchema(z.object({ created: z.number().int() })), ...errorResponses },
      },
    },
    async (request, reply) =>
      reply.code(201).send(ok(await createMasterPolicies(app.db, request, request.body))),
  );

  app.delete(
    "/categories/:id",
    {
      schema: {
        tags,
        security,
        summary: "Remove an empty master category (agencies keep their own copy)",
        params: masterIdParamsSchema,
        response: { 200: successSchema(z.object({ id: z.uuid() })), ...errorResponses },
      },
    },
    async (request) => ok(await deleteMasterCategory(app.db, request, request.params.id)),
  );

  app.delete(
    "/policies/:id",
    {
      schema: {
        tags,
        security,
        summary: "Remove a master policy (agencies keep their own copy)",
        params: masterIdParamsSchema,
        response: { 200: successSchema(z.object({ id: z.uuid() })), ...errorResponses },
      },
    },
    async (request) => ok(await deleteMasterPolicy(app.db, request, request.params.id)),
  );

  app.post(
    "/:insurerId/sync-tenants",
    {
      schema: {
        tags,
        security,
        summary: "Add this insurer's new master entries to every agency that sells for it",
        description:
          "Additive only: it never renames, removes or overwrites what an agency already has, and respects each agency's enabled lines.",
        params: masterInsurerParamsSchema,
        response: { 200: successSchema(masterSyncResultSchema), ...errorResponses },
      },
    },
    async (request) => ok(await syncMasterToTenants(app.db, request, request.params.insurerId)),
  );
};

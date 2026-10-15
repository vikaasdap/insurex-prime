import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAuth, tenantAdminOnly } from "../../middleware/role.js";
import {
  errorResponses,
  ok,
  paginated,
  paginatedSchema,
  successSchema,
} from "../../utils/response.js";
import {
  createPoliciesBulkBodySchema,
  createPolicyBodySchema,
  listPoliciesQuerySchema,
  policyIdParamsSchema,
  policiesBulkCreatedSchema,
  policySchema,
  policyStatusBodySchema,
  updatePolicyBodySchema,
} from "./policies.schemas.js";
import {
  createPoliciesBulk,
  createPolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  setPolicyStatus,
  updatePolicy,
} from "./policies.service.js";

const adminOnly = tenantAdminOnly;
const security = [{ bearerAuth: [] }];
const tags = ["Policies"];

export const policyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get(
    "",
    {
      schema: {
        tags,
        security,
        summary: "List catalog policies",
        description:
          "AGENT callers only receive ACTIVE policies (the `status` filter is ignored). Search matches policy name and code. Date range filters `createdAt`.",
        querystring: listPoliciesQuerySchema,
        response: { 200: paginatedSchema(policySchema), ...errorResponses },
      },
    },
    async (request) => {
      const { items, meta } = await listPolicies(request.db, requireAuth(request), request.query);
      return paginated(items, meta);
    },
  );

  app.get(
    "/:id",
    {
      schema: {
        tags,
        security,
        summary: "Get a catalog policy",
        description: "AGENT callers receive 404 for INACTIVE policies.",
        params: policyIdParamsSchema,
        response: { 200: successSchema(policySchema), ...errorResponses },
      },
    },
    async (request) => ok(await getPolicy(request.db, requireAuth(request), request.params.id)),
  );

  app.post(
    "",
    {
      preHandler: adminOnly,
      schema: {
        tags,
        security,
        summary: "Create a catalog policy (SUPER_ADMIN)",
        body: createPolicyBodySchema,
        response: { 201: successSchema(policySchema), ...errorResponses },
      },
    },
    async (request, reply) =>
      reply.code(201).send(ok(await createPolicy(request.db, request, request.body))),
  );

  app.post(
    "/bulk",
    {
      preHandler: adminOnly,
      schema: {
        tags,
        security,
        summary: "Add several policies to one category at once (tenant admin)",
        description:
          "Each policy needs a name; the policy code is made from the name when left blank and the UIN is optional. Nothing is saved if any row is invalid or already exists in the category.",
        body: createPoliciesBulkBodySchema,
        response: { 201: successSchema(policiesBulkCreatedSchema), ...errorResponses },
      },
    },
    async (request, reply) =>
      reply.code(201).send(ok(await createPoliciesBulk(request.db, request, request.body))),
  );

  app.patch(
    "/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags,
        security,
        summary: "Update a catalog policy (SUPER_ADMIN)",
        description: "Changes do not affect premiums of policies already sold.",
        params: policyIdParamsSchema,
        body: updatePolicyBodySchema,
        response: { 200: successSchema(policySchema), ...errorResponses },
      },
    },
    async (request) => ok(await updatePolicy(request.db, request, request.params.id, request.body)),
  );

  app.patch(
    "/:id/status",
    {
      preHandler: adminOnly,
      schema: {
        tags,
        security,
        summary: "Activate or deactivate a policy (SUPER_ADMIN)",
        description: "INACTIVE policies stay visible to SUPER_ADMIN but cannot be sold.",
        params: policyIdParamsSchema,
        body: policyStatusBodySchema,
        response: { 200: successSchema(policySchema), ...errorResponses },
      },
    },
    async (request) =>
      ok(await setPolicyStatus(request.db, request, request.params.id, request.body.status)),
  );

  app.delete(
    "/:id",
    {
      preHandler: adminOnly,
      schema: {
        tags,
        security,
        summary: "Delete a catalog policy (SUPER_ADMIN)",
        description: "Returns 409 if the policy has been sold.",
        params: policyIdParamsSchema,
        response: { 200: successSchema(z.object({ id: z.uuid() })), ...errorResponses },
      },
    },
    async (request) => {
      await deletePolicy(request.db, request, request.params.id);
      return ok({ id: request.params.id });
    },
  );
};

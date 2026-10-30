"use strict";
const { app } = require("@azure/functions");
const { getPrincipal } = require("./lib/auth");
const { cosmosRepo } = require("./lib/repo");
const { acsMailer } = require("./lib/mailer");
const { HttpError } = require("./lib/validate");
const H = require("./lib/handlers");

let repo, mailer;
const getRepo = () => (repo ||= cosmosRepo());
const getMailer = () => (mailer === undefined ? (mailer = acsMailer()) : mailer);

function route(name, methods, path, handler) {
  app.http(name, {
    methods, route: path, authLevel: "anonymous",
    handler: async (request, context) => {
      try {
        let body = null;
        if (["POST", "PUT"].includes(request.method)) {
          try { body = await request.json(); } catch { throw new HttpError(400, "The request body must be JSON."); }
        }
        const res = await handler({ repo: getRepo(), principal: getPrincipal(request.headers), params: request.params, query: request.query.get("q"), body, mailer: getMailer() });
        return { status: res.status, jsonBody: res.json, headers: { "Cache-Control": "no-store" } };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, jsonBody: { error: e.message } };
        context.error(e);
        return { status: 500, jsonBody: { error: "Something went wrong on our side. Try again in a moment." } };
      }
    },
  });
}

route("health", ["GET"], "health", async () => ({ status: 200, json: { ok: true, backend: "azure" } }));
route("public", ["GET"], "public", H.publicData);
route("network", ["GET"], "network", H.network);
route("ror", ["GET"], "ror", async (ctx) => H.rorSearch({ ...ctx, query: ctx.query }));
route("scholar", ["POST"], "profile/scholar", H.fetchScholar);
route("verifyStart", ["POST"], "verification/start", H.verifyStart);
route("verifyConfirm", ["POST"], "verification/confirm", H.verifyConfirm);
route("me", ["GET"], "me", H.me);
route("profile", ["PUT"], "profile", H.putProfile);
route("groupsCreate", ["POST"], "groups", H.createGroup);
route("groupsUpdate", ["PUT"], "groups/{id}", H.updateGroup);
route("groupsDelete", ["DELETE"], "groups/{id}", H.deleteGroup);
route("studiesCreate", ["POST"], "studies", H.createStudy);
route("studiesUpdate", ["PUT"], "studies/{id}", H.updateStudy);
route("studiesDelete", ["DELETE"], "studies/{id}", H.deleteStudy);
route("studyApplicants", ["GET"], "studies/{id}/applications", H.studyApplicants);
route("applicationsCreate", ["POST"], "applications", H.apply);
route("applicationsMine", ["GET"], "applications/mine", H.myApplications);

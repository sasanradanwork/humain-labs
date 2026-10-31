"use strict";
/**
 * Local preview of the whole site without Azure: serves index.html, runs the
 * same API handlers against an in-memory copy of the seed data, and fakes the
 * Static Web Apps sign-in. Data resets when you stop it.
 *   node scripts/dev-server.js   →  http://localhost:4280
 * For development against a real Cosmos DB, use the SWA CLI instead (see README).
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { memoryRepo } = require("../src/lib/repo");
const H = require("../src/lib/handlers");
const { HttpError } = require("../src/lib/validate");
const { getPrincipal } = require("../src/lib/auth");

const PORT = Number(process.env.PORT || 4280);
process.env.DEV_SHOW_CODES = "1"; // no email service locally: verification codes are shown on screen
// Serves the built React app. Run `npm run build` in ../web first (or use Vite's
// own dev server on :5173, which proxies /api here).
const ROOT = path.join(__dirname, "..", "..", "web", "dist");
const repo = memoryRepo(JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8")));

const routes = [
  ["GET", /^health$/, async () => ({ status: 200, json: { ok: true, backend: "azure" } })],
  ["GET", /^public$/, H.publicData], ["GET", /^network$/, H.network],
  ["GET", /^ror$/, H.rorSearch], ["POST", /^profile\/scholar$/, H.fetchScholar], ["POST", /^verification\/start$/, H.verifyStart], ["POST", /^verification\/confirm$/, H.verifyConfirm], ["GET", /^me$/, H.me], ["PUT", /^profile$/, H.putProfile],
  ["POST", /^groups$/, H.createGroup], ["PUT", /^groups\/([^/]+)$/, H.updateGroup], ["DELETE", /^groups\/([^/]+)$/, H.deleteGroup],
  ["POST", /^studies$/, H.createStudy], ["PUT", /^studies\/([^/]+)$/, H.updateStudy], ["DELETE", /^studies\/([^/]+)$/, H.deleteStudy],
  ["GET", /^studies\/([^/]+)\/applications$/, H.studyApplicants],
  ["POST", /^applications$/, H.apply], ["GET", /^applications\/mine$/, H.myApplications],
  ["PUT", /^participant$/, H.putParticipant],
  ["POST", /^applications\/([^/]+)\/withdraw$/, H.withdrawApplication],
  ["PUT", /^applications\/([^/]+)\/rating$/, H.rateApplication],
];
const cookie = (req, k) => (req.headers.cookie || "").split(/;\s*/).map((c) => c.split("=")).find(([n]) => n === k)?.[1];
// Same header format Static Web Apps sends, decoded by the same code the API uses in Azure.
const rawPrincipal = (req) => { const c = cookie(req, "dev_principal"); return c ? decodeURIComponent(c) : null; };
const principal = (req) => getPrincipal({ "x-ms-client-principal": rawPrincipal(req) });
const send = (res, status, body, type = "application/json") => { res.writeHead(status, { "Content-Type": type }); res.end(type === "application/json" ? JSON.stringify(body) : body); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const p = url.pathname.slice(5);
    for (const [m, re, fn] of routes) {
      const hit = req.method === m && p.match(re);
      if (!hit) continue;
      let body = null;
      if (m === "POST" || m === "PUT") { let raw = ""; for await (const ch of req) raw += ch; try { body = JSON.parse(raw || "null"); } catch { return send(res, 400, { error: "The request body must be JSON." }); } }
      try { const r = await fn({ repo, principal: principal(req), params: { id: hit[1] && decodeURIComponent(hit[1]) }, query: url.searchParams.get("q"), body }); return send(res, r.status, r.json); }
      catch (e) { if (e instanceof HttpError) return send(res, e.status, { error: e.message }); console.error(e); return send(res, 500, { error: "Server error" }); }
    }
    return send(res, 404, { error: "Not found" });
  }
  if (url.pathname === "/.auth/me") { const raw = rawPrincipal(req); let p = null; try { p = raw && JSON.parse(Buffer.from(raw, "base64").toString()); } catch {} return send(res, 200, { clientPrincipal: p && { ...p, userRoles: ["anonymous", "authenticated"] } }); }
  if (url.pathname.startsWith("/.auth/login/")) {
    const provider = url.pathname.split("/")[3]; const back = url.searchParams.get("post_login_redirect_uri") || "/";
    if (req.method === "POST") {
      let raw = ""; for await (const ch of req) raw += ch; const f = new URLSearchParams(raw); const who = (f.get("user") || "").trim() || "tester@example.com";
      const p = Buffer.from(JSON.stringify({ identityProvider: provider, userId: "dev-" + who.toLowerCase(), userDetails: who })).toString("base64");
      res.writeHead(302, { "Set-Cookie": `dev_principal=${encodeURIComponent(p)}; Path=/; HttpOnly; SameSite=Lax`, Location: back }); return res.end();
    }
    return send(res, 200, `<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:system-ui;max-width:420px;margin:60px auto"><h2>Local sign-in (${provider})</h2><p>Stands in for Microsoft or GitHub sign-in during local preview.</p><form method=post><input name=user placeholder="Email or username" style="width:100%;padding:8px" autofocus><button style="margin-top:10px;padding:8px 14px">Sign in</button></form>`, "text/html");
  }
  if (url.pathname === "/.auth/logout") { res.writeHead(302, { "Set-Cookie": "dev_principal=; Path=/; Max-Age=0", Location: url.searchParams.get("post_logout_redirect_uri") || "/" }); return res.end(); }
  const file = path.join(ROOT, url.pathname === "/" ? "index.html" : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "Not found", "text/plain");
  const type = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript" }[path.extname(file)] || "application/octet-stream";
  send(res, 200, fs.readFileSync(file), type);
}).listen(PORT, () => console.log(`HumAIn Labs local preview: http://localhost:${PORT}`));

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

// Crossref is reached over the internet, which a development machine may not have.
// DEV_CROSSREF_STUB=1 answers any well-formed DOI with a made-up paper, so the editor
// can be worked on offline. It is never used in deployment: the real lookup is the
// default, and this file is not part of the deployed API.
const devCrossref = process.env.DEV_CROSSREF_STUB === "1"
  ? async (doi) => {
      const n = [...doi].reduce((a, c) => a + c.charCodeAt(0), 0);
      const year = 2022 + (n % 5);
      const names = [["Nwosu, A."], ["Radan, S.", "Park, J."], ["Okafor, N.", "Radan, S."], ["Tanaka, A.", "Silva, M.", "Radan, S."]][n % 4];
      return {
        doi,
        title: ["Technostress and the always-on worker", "Reading IDE warnings under load", "Notification timing and focus", "Measuring attention at scale"][n % 4],
        authorNames: names,
        authors: names.join(", "),
        venue: ["CHI", "Behaviour & Information Technology", "TOCHI", "Scientific Reports"][n % 4],
        year,
        url: "https://doi.org/" + doi,
        citations: n % 240,
        fetchedAt: new Date().toISOString().slice(0, 10),
      };
    }
  : null;
if (devCrossref) console.log("  (DEV_CROSSREF_STUB on: DOIs resolve to made-up papers)");

// The same idea for the ROR registry, so the institution picker can be worked on without
// the internet. Never used in deployment: this file is not part of the deployed API.
const devRor = process.env.DEV_ROR_STUB === "1"
  ? async (url) => {
      const q = decodeURIComponent((url.split("query=")[1] || "").split("&")[0]);
      const make = (name, city, country, ror) => ({
        id: `https://ror.org/${ror}`,
        names: [{ value: name, types: ["ror_display"] }],
        locations: [{ geonames_details: { name: city, country_name: country } }],
      });
      return {
        items: [
          make(`University of ${q}`, q, "United Kingdom", "027m9bs27"),
          make(`${q} Institute of Technology`, q, "United States", "05gq02987"),
          make(`${q} Business School`, q, "Nigeria", "01hcx6992"),
        ],
      };
    }
  : null;
if (devRor) console.log("  (DEV_ROR_STUB on: institution search returns made-up universities)");
// Serves the built React app. Run `npm run build` in ../web first (or use Vite's
// own dev server on :5173, which proxies /api here).
const ROOT = path.join(__dirname, "..", "..", "web", "dist");
const repo = memoryRepo(JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8")));

const routes = [
  ["GET", /^health$/, async () => ({ status: 200, json: { ok: true, backend: "azure" } })],
  ["GET", /^status$/, H.statusData],
  ["GET", /^roadmap$/, H.roadmap],
  ["POST", /^roadmap\/([^/]+)\/vote$/, H.roadmapVote],
  ["GET", /^public$/, H.publicData], ["GET", /^network$/, H.network],
  ["GET", /^ror$/, H.rorSearch], ["POST", /^profile\/scholar$/, H.fetchScholar], ["POST", /^verification\/start$/, H.verifyStart], ["POST", /^verification\/confirm$/, H.verifyConfirm], ["GET", /^me$/, H.me], ["PUT", /^profile$/, H.putProfile],
  ["POST", /^groups$/, H.createGroup], ["PUT", /^groups\/([^/]+)$/, H.updateGroup], ["DELETE", /^groups\/([^/]+)$/, H.deleteGroup],
  ["POST", /^studies$/, H.createStudy], ["PUT", /^studies\/([^/]+)$/, H.updateStudy], ["DELETE", /^studies\/([^/]+)$/, H.deleteStudy],
  ["GET", /^studies\/([^/]+)\/applications$/, H.studyApplicants],
  ["POST", /^applications$/, H.apply], ["GET", /^applications\/mine$/, H.myApplications],
  ["PUT", /^participant$/, H.putParticipant], ["DELETE", /^participant$/, H.deleteParticipant],
  ["POST", /^participant\/email\/start$/, H.participantEmailStart], ["POST", /^participant\/email\/confirm$/, H.participantEmailConfirm],
  ["DELETE", /^profile$/, H.deleteResearcherProfile],
  ["POST", /^researchers\/([^/]+)\/endorse$/, H.endorseResearcher],
  ["GET", /^doi$/, H.resolveDoi],
  ["POST", /^applications\/([^/]+)\/withdraw$/, H.withdrawApplication],
  ["PUT", /^applications\/([^/]+)\/rating$/, H.rateApplication],
  ["POST", /^applications\/([^/]+)\/advance$/, H.advanceApplication],
  ["POST", /^applications\/([^/]+)\/reject$/, H.rejectApplication],
  ["POST", /^identity\/start$/, H.idStart],
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
      try { const r = await fn({ repo, principal: principal(req), params: { id: hit[1] && decodeURIComponent(hit[1]) }, query: url.searchParams.get("q"), body, ...(devCrossref ? { crossref: devCrossref } : {}), ...(devRor ? { http: devRor } : {}) }); return send(res, r.status, r.json); }
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

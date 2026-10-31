"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { memoryRepo } = require("../src/lib/repo");
const H = require("../src/lib/handlers");
const { getPrincipal } = require("../src/lib/auth");

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../scripts/seed-data.json"), "utf8"));
const fresh = () => memoryRepo(seed);
const user = (id) => ({ userId: id, provider: "aad", details: id + "@example.com" });
const run = async (fn, ctx) => { try { return await fn(ctx); } catch (e) { return { status: e.status || 500, json: { error: e.message } }; } };
async function verifiedProfile(repo, id, over = {}) {
  const r = await H.putProfile({ repo, principal: user(id), body: profile({ handle: "h-" + id, ...over }) });
  await repo.upsert("researchers", { ...(await repo.get("researchers", r.json.id)), verified: { method: "institution-email", domain: "uni.ac.uk", at: "2026-09-01" } });
  return r.json;
}
const soon = (days = 10) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const participant = (repo, id, over = {}) => H.putParticipant({ repo, principal: user(id), body: { name: "Participant " + id, email: id + "@example.com", age: 30, country: "Kenya", ...over } });
const applyBody = (studyId, over = {}) => ({ studyId, consent: true, ...over });
const profile = (over = {}) => ({ name: "Amrit Kaur", handle: "amrit-kaur", position: "PhD student", institution: "HumAIn", country: "United Kingdom", field: "Computer science", email: "amrit@example.com", bio: "Intrusion detection.", linkedin: "https://www.linkedin.com/in/amrit", ...over });

test("principal header is decoded", () => {
  const h = Buffer.from(JSON.stringify({ userId: "u1", identityProvider: "github", userDetails: "amrit" })).toString("base64");
  assert.equal(getPrincipal({ "x-ms-client-principal": h }).userId, "u1");
  assert.equal(getPrincipal({}), null);
});

test("participants get studies only; the directory and counts need a researcher profile", async () => {
  const repo = fresh();
  const pub = await H.publicData({ repo });
  assert.equal(pub.json.studies.length, 6);
  assert.ok(pub.json.studies.every((s) => s.trend && s.trend.weekly.length === 8 && s.trend.weekly.every((w) => w <= 1)));
  assert.ok(!("researchers" in pub.json) && !("groups" in pub.json));
  // Global reach is open to everyone, as country counts only
  assert.equal(pub.json.reach.total, 35);
  assert.ok(pub.json.reach.byCountry["Nigeria"] > 0 && !("byStudy" in pub.json.reach));
  assert.equal(pub.json.studies.find((s) => s.id === "s4").researcherVerified.domain, "example.edu");
  assert.equal((await run(H.network, { repo, principal: user("p1") })).status, 403);
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  const net = await run(H.network, { repo, principal: user("u1") });
  assert.equal(net.json.stats.total, 35);
  assert.ok(net.json.researchers.every((x) => !("userId" in x) && !("verification" in x)));
});

test("verification: institution email only, code checked, lapses when institution changes", async () => {
  const repo = fresh(); const sent = [];
  const mailer = { send: async (m) => sent.push(m) };
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  assert.equal((await run(H.verifyStart, { repo, principal: user("u1"), body: { email: "me@gmail.com" }, mailer })).status, 400);
  assert.equal((await run(H.verifyStart, { repo, principal: user("u1"), body: { email: "a.kaur@warwick.ac.uk" }, mailer, now: 1000 })).status, 200);
  assert.equal((await run(H.verifyStart, { repo, principal: user("u1"), body: { email: "a.kaur@warwick.ac.uk" }, mailer, now: 2000 })).status, 429);
  const code = sent[0].text.match(/\d{6}/)[0];
  assert.equal((await run(H.verifyConfirm, { repo, principal: user("u1"), body: { code: "000000" === code ? "111111" : "000000" }, now: 3000 })).status, 400);
  const okRes = await run(H.verifyConfirm, { repo, principal: user("u1"), body: { code }, now: 4000 });
  assert.equal(okRes.json.verified.domain, "warwick.ac.uk");
  assert.ok(!("verification" in okRes.json));
  const moved = await run(H.putProfile, { repo, principal: user("u1"), body: profile({ institution: "Coventry University" }) });
  assert.equal(moved.json.verified, undefined);
});

test("expired codes are refused", async () => {
  const repo = fresh(); const sent = [];
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  await H.verifyStart({ repo, principal: user("u1"), body: { email: "a@uni.ac.uk" }, mailer: { send: async (m) => sent.push(m) }, now: 0 });
  const code = sent[0].text.match(/\d{6}/)[0];
  assert.equal((await run(H.verifyConfirm, { repo, principal: user("u1"), body: { code }, now: 16 * 60 * 1000 })).status, 400);
});

test("profile: sign-in required, linkedin validated, handle unique, then created and updated", async () => {
  const repo = fresh();
  assert.equal((await run(H.putProfile, { repo, principal: null, body: profile() })).status, 401);
  assert.equal((await run(H.putProfile, { repo, principal: user("u1"), body: profile({ linkedin: "https://example.com/me" }) })).status, 400);
  assert.equal((await run(H.putProfile, { repo, principal: user("u1"), body: profile({ handle: "amara-nwosu" }) })).status, 409);
  const created = await run(H.putProfile, { repo, principal: user("u1"), body: profile() });
  assert.equal(created.status, 201);
  const again = await run(H.putProfile, { repo, principal: user("u1"), body: profile({ institution: "Coventry University" }) });
  assert.equal(again.status, 200);
  assert.equal(again.json.id, created.json.id);
});

test("groups: need a profile, members must be registered, owner always kept", async () => {
  const repo = fresh();
  const base = { name: "Secure AI Lab", institution: "HumAIn", country: "United Kingdom", field: "Computer science", email: "lab@example.com", summary: "Safer AI systems.", about: "We study attacks on ML systems." };
  assert.equal((await run(H.createGroup, { repo, principal: user("u1"), body: base })).status, 403);
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  assert.equal((await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, members: [{ researcherId: "nobody" }] } })).status, 400);
  const g = await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, members: [{ researcherId: "r5", role: "Collaborator" }], publications: [{ title: "Paper", authorNames: ["Amrit Kaur"], venue: "Journal of Big Data", year: 2023 }], openings: [{ type: "Postdoc", title: "Postdoc in AI security" }] } });
  assert.equal(g.status, 201);
  assert.equal(g.json.members[0].role, "Group lead");
  assert.equal(g.json.members.length, 2);
  // Removing the owner from members doesn't stick
  const u = await run(H.updateGroup, { repo, principal: user("u1"), params: { id: g.json.id }, body: { ...base, members: [] } });
  assert.equal(u.json.members.length, 1);
  // Someone else can't edit or delete it
  await H.putProfile({ repo, principal: user("u2"), body: profile({ handle: "someone-else", email: "x@example.com" }) });
  assert.equal((await run(H.updateGroup, { repo, principal: user("u2"), params: { id: g.json.id }, body: base })).status, 403);
  assert.equal((await run(H.deleteGroup, { repo, principal: user("u2"), params: { id: g.json.id } })).status, 403);
});

test("only verified researchers can post, and only their studies are shown to participants", async () => {
  const repo = fresh();
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  const body = { title: "Survey", description: "15 min", criteria: "18+", closesAt: "2099-01-01" };
  assert.equal((await run(H.createStudy, { repo, principal: user("u1"), body })).status, 403);
  // An existing study whose researcher isn't verified is hidden and can't be applied to
  await repo.upsert("studies", { id: "sx", title: "Old", researcherId: (await H.me({ repo, principal: user("u1") })).json.researcher.id, postedAt: "2026-09-01" });
  assert.ok(!(await H.publicData({ repo })).json.studies.some((s) => s.id === "sx"));
  assert.equal((await run(H.apply, { repo, principal: user("p9"), body: { studyId: "sx", name: "A", email: "a@example.com", age: 30, country: "United Kingdom", consent: true } })).status, 404);
  const mine = (await H.network({ repo, principal: user("u1") })).json.myStudies;
  assert.ok(mine.find((s) => s.id === "sx").hidden);
});

test("trending: recent applications outrank older ones", () => {
  const { trendFor } = require("../src/lib/trending");
  const now = Date.parse("2026-09-20T12:00:00Z");
  const a = trendFor({ id: "a", postedAt: "2026-07-01" }, [{ studyId: "a", date: "2026-09-19" }, { studyId: "a", date: "2026-09-18" }], now);
  const b = trendFor({ id: "b", postedAt: "2026-07-01" }, [{ studyId: "b", date: "2026-08-01" }, { studyId: "b", date: "2026-08-02" }, { studyId: "b", date: "2026-08-03" }], now);
  assert.ok(a.score > b.score);
  assert.ok(a.rising && !b.rising);
  assert.equal(Math.max(...a.weekly), 1);
});

test("studies and applications: only the study owner sees applicants, one application per person", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  await participant(repo, "p1");
  const s = await H.createStudy({ repo, principal: user("u1"), body: { title: "Phishing awareness", description: "20 min survey", criteria: "18+", format: "Online", closesAt: soon() } });
  assert.equal(s.status, 201);
  const app = { studyId: s.json.id, name: "P One", email: "p1@example.com", age: 30, country: "Kenya", consent: true };
  assert.equal((await run(H.apply, { repo, principal: user("p1"), body: { ...app, consent: false } })).status, 400);
  assert.equal((await run(H.apply, { repo, principal: user("p1"), body: app })).status, 201);
  assert.equal((await run(H.apply, { repo, principal: user("p1"), body: app })).status, 409);
  assert.equal((await run(H.studyApplicants, { repo, principal: user("p1"), params: { id: s.json.id } })).status, 403);
  const list = await run(H.studyApplicants, { repo, principal: user("u1"), params: { id: s.json.id } });
  assert.equal(list.json.length, 1);
  assert.ok(!("userId" in list.json[0]));
  assert.equal((await H.myApplications({ repo, principal: user("p1") })).json.length, 1);
  await H.deleteStudy({ repo, principal: user("u1"), params: { id: s.json.id } });
  assert.equal((await H.myApplications({ repo, principal: user("p1") })).json.length, 0);
});

test("researcher accounts can't apply to studies", async () => {
  const repo = fresh();
  await H.putProfile({ repo, principal: user("u1"), body: profile() });
  const r = await run(H.apply, { repo, principal: user("u1"), body: { studyId: "s1", name: "A", email: "a@example.com", age: 30, country: "United Kingdom", consent: true } });
  assert.equal(r.status, 403);
});

test("studies need a future closing date, and closed studies disappear", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const base = { title: "Survey", description: "15 min", criteria: "18+" };
  assert.equal((await run(H.createStudy, { repo, principal: user("u1"), body: base })).status, 400);
  assert.equal((await run(H.createStudy, { repo, principal: user("u1"), body: { ...base, closesAt: "2020-01-01" } })).status, 400);
  const s = await run(H.createStudy, { repo, principal: user("u1"), body: { ...base, closesAt: soon(3) } });
  assert.equal(s.status, 201);
  await repo.upsert("studies", { ...s.json, closesAt: "2020-01-01" });
  assert.ok(!(await H.publicData({ repo })).json.studies.some((x) => x.id === s.json.id));
  assert.equal((await run(H.apply, { repo, principal: user("p1"), body: { studyId: s.json.id, name: "A", email: "a@example.com", age: 30, country: "United Kingdom", consent: true } })).status, 410);
});

test("publication stats come from OpenAlex by ORCID", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const http = async (url) => {
    assert.ok(url.includes("/authors/orcid:0000-0002-1825-0097"));
    return { id: "https://openalex.org/A123", display_name: "Amrit Kaur", works_count: 12, cited_by_count: 340,
      summary_stats: { h_index: 8, i10_index: 6 }, counts_by_year: [{ year: 2026, works_count: 3, cited_by_count: 90 }, { year: 2019, works_count: 5, cited_by_count: 10 }] };
  };
  const now = Date.parse("2026-09-20T00:00:00Z");
  assert.equal((await run(H.fetchScholar, { repo, principal: user("u1"), body: { orcid: "not-an-orcid" }, http, now })).status, 400);
  const r = await run(H.fetchScholar, { repo, principal: user("u1"), body: { orcid: "https://orcid.org/0000-0002-1825-0097" }, http, now });
  assert.equal(r.json.metrics.citations, 340);
  assert.equal(r.json.metrics.hIndex, 8);
  assert.equal(r.json.metrics.recentWorks, 3);
  assert.equal(r.json.orcid, "0000-0002-1825-0097");
  // A missing OpenAlex record is reported, not swallowed
  const missing = async () => { const e = new Error("404"); e.status = 404; throw e; };
  assert.equal((await run(H.fetchScholar, { repo, principal: user("u1"), http: missing, now })).status, 404);
});

test("profile links: Google Scholar must be a Scholar profile URL", async () => {
  const repo = fresh();
  assert.equal((await run(H.putProfile, { repo, principal: user("u1"), body: profile({ scholar: "https://example.com/me" }) })).status, 400);
  const okRes = await run(H.putProfile, { repo, principal: user("u1"), body: profile({ scholar: "https://scholar.google.com/citations?user=ABC123def", orcid: "0000-0002-1825-0097" }) });
  assert.equal(okRes.json.orcid, "0000-0002-1825-0097");
});

test("group citations can't be typed in; they come from members' OpenAlex figures", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const base = { name: "Lab", institution: "HumAIn", country: "United Kingdom", field: "Computer science", email: "lab@example.com", summary: "s", about: "a", citations: 999999 };
  const g = await run(H.createGroup, { repo, principal: user("u1"), body: base });
  assert.equal(g.status, 201);
  assert.equal(g.json.citations, undefined);
  const u = await run(H.updateGroup, { repo, principal: user("u1"), params: { id: g.json.id }, body: base });
  assert.equal(u.json.citations, undefined);
});

test("groups get a permanent, checkable public ID and can carry a ROR ID", async () => {
  const { isGroupId } = require("../src/lib/ids");
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const base = { name: "Lab", institution: "University of Manchester", country: "United Kingdom", field: "Human–computer interaction", email: "lab@example.com", summary: "s", about: "a" };
  assert.equal((await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, ror: "not-a-ror" } })).status, 400);
  const g = await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, ror: "https://ror.org/027m9bs27", rorName: "University of Manchester" } });
  assert.match(g.json.publicId, /^HLG-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
  assert.ok(isGroupId(g.json.publicId));
  assert.equal(g.json.ror, "027m9bs27");
  // the ID survives edits
  const u = await run(H.updateGroup, { repo, principal: user("u1"), params: { id: g.json.id }, body: base });
  assert.equal(u.json.publicId, g.json.publicId);
});

test("ROR search needs a researcher profile and maps the registry's fields", async () => {
  const repo = fresh();
  const http = async () => ({ items: [{ id: "https://ror.org/027m9bs27", names: [{ value: "Manchester Uni", types: ["alias"] }, { value: "University of Manchester", types: ["ror_display"] }],
    locations: [{ geonames_details: { name: "Manchester", country_name: "United Kingdom" } }] }] });
  assert.equal((await run(H.rorSearch, { repo, principal: user("p1"), query: "manchester", http })).status, 403);
  await verifiedProfile(repo, "u1");
  const r = await run(H.rorSearch, { repo, principal: user("u1"), query: "manchester", http });
  assert.deepEqual(r.json.results[0], { ror: "027m9bs27", name: "University of Manchester", country: "United Kingdom", city: "Manchester" });
  const down = async () => { throw new Error("offline"); };
  assert.equal((await run(H.rorSearch, { repo, principal: user("u1"), query: "x", http: down })).status, 502);
});

test("standard lists: choices must come from the list, but capitalisation doesn't matter", async () => {
  const repo = fresh();
  assert.equal((await run(H.putProfile, { repo, principal: user("u1"), body: profile({ field: "Cybersecurity" }) })).status, 400);
  assert.equal((await run(H.putProfile, { repo, principal: user("u1"), body: profile({ position: "Wizard" }) })).status, 400);
  const created = await run(H.putProfile, { repo, principal: user("u1"), body: profile({ field: "computer SCIENCE", country: "united kingdom", position: "professor" }) });
  assert.equal(created.status, 201);
  assert.equal(created.json.field, "Computer science");
  assert.equal(created.json.country, "United Kingdom");
  assert.equal(created.json.position, "Professor");
});

test("the web and API copies of the standard lists match", () => {
  const vm = require("node:vm");
  const src = fs.readFileSync(path.join(__dirname, "../../web/src/lib/lists.js"), "utf8").replace(/export const/g, "const");
  const ctx = {};
  vm.runInNewContext(src + ";__out = { FIELDS, POSITIONS, COUNTRY_NAMES };", ctx);
  const api = require("../src/lib/lists");
  // Compared as JSON: arrays from the vm context have a different prototype, so deepEqual would reject them.
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
  same(ctx.__out.FIELDS, api.FIELDS);
  same(ctx.__out.POSITIONS, api.POSITIONS);
  same(ctx.__out.COUNTRY_NAMES, api.COUNTRY_NAMES);
});

test("author names turn into Harvard format", () => {
  const { harvardAuthors } = require("../src/lib/harvard");
  assert.equal(harvardAuthors(["Jane Ann Smith"]), "Smith, J.A.");
  assert.equal(harvardAuthors(["Jane Smith", "Jean-Luc Picard"]), "Smith, J. and Picard, J.-L.");
  assert.equal(harvardAuthors(["Jane Smith", "Bo Li", "Ana Ruiz"]), "Smith, J., Li, B. and Ruiz, A.");
  assert.equal(harvardAuthors(["van der Berg, Jan"]), "van der Berg, J.");
  assert.equal(harvardAuthors(["Plato"]), "Plato");
});

test("publications store the author names and the Harvard string; at least one author is needed", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const base = { name: "Lab", institution: "HumAIn", country: "United Kingdom", field: "Computer science", email: "lab@example.com", summary: "s", about: "a" };
  const pub = { title: "Paper", venue: "Journal", year: 2024 };
  assert.equal((await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, publications: [{ ...pub, authorNames: [] }] } })).status, 400);
  const g = await run(H.createGroup, { repo, principal: user("u1"), body: { ...base, publications: [{ ...pub, authorNames: ["Jane Ann Smith", "Bo Li"] }] } });
  assert.equal(g.json.publications[0].authors, "Smith, J.A. and Li, B.");
  assert.deepEqual(g.json.publications[0].authorNames, ["Jane Ann Smith", "Bo Li"]);
});

test("participants set up a profile once, and every application uses it", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  const s = await H.createStudy({ repo, principal: user("u1"), body: { title: "Survey", description: "15 min", criteria: "18+", closesAt: soon(10) } });
  assert.equal((await run(H.apply, { repo, principal: user("p1"), body: applyBody(s.json.id) })).status, 412);
  const created = await participant(repo, "p1", { name: "Tunde Bakare", email: "tunde@example.com", age: 29, country: "Nigeria" });
  assert.equal(created.status, 201);
  assert.equal((await H.me({ repo, principal: user("p1") })).json.participant.name, "Tunde Bakare");
  const first = await run(H.apply, { repo, principal: user("p1"), body: applyBody(s.json.id, { name: "ignored", notes: "Free at weekends" }) });
  assert.equal(first.status, 201);
  assert.equal(first.json.name, "Tunde Bakare");
  assert.equal(first.json.age, "29");
  // Changing the profile doesn't rewrite past applications
  await participant(repo, "p1", { name: "Tunde B.", email: "tunde@example.com", age: 30, country: "Ghana" });
  const mine = (await H.myApplications({ repo, principal: user("p1") })).json;
  assert.equal(mine[0].name, "Tunde Bakare");
  assert.equal(mine[0].status, "active");
  assert.equal(mine[0].rating, undefined);
});

test("participants can withdraw up to the day before the deadline, and it is recorded", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  await participant(repo, "p1");
  await participant(repo, "p2");
  const closes = soon(5);
  const s = await H.createStudy({ repo, principal: user("u1"), body: { title: "Survey", description: "15 min", criteria: "18+", closesAt: closes } });
  const a = (await run(H.apply, { repo, principal: user("p1"), body: applyBody(s.json.id) })).json;
  assert.equal((await run(H.withdrawApplication, { repo, principal: user("p2"), params: { id: a.id } })).status, 404);
  const dayBefore = Date.parse(closes + "T09:00:00Z") - 86400000;
  assert.equal((await run(H.withdrawApplication, { repo, principal: user("p1"), params: { id: a.id }, now: dayBefore })).status, 200);
  assert.equal((await run(H.withdrawApplication, { repo, principal: user("p1"), params: { id: a.id }, now: dayBefore })).status, 409);
  const rows = (await run(H.studyApplicants, { repo, principal: user("u1"), params: { id: s.json.id } })).json;
  assert.equal(rows[0].status, "withdrawn");
  assert.equal((await H.myApplications({ repo, principal: user("p1") })).json[0].status, "withdrawn");
  // Too late on the deadline day itself
  const b = (await run(H.apply, { repo, principal: user("p2"), body: applyBody(s.json.id) })).json;
  assert.equal((await run(H.withdrawApplication, { repo, principal: user("p2"), params: { id: b.id }, now: Date.parse(closes + "T09:00:00Z") })).status, 410);
});

test("researchers rate participants once a study has closed; other researchers see only the score", async () => {
  const repo = fresh();
  await verifiedProfile(repo, "u1");
  await verifiedProfile(repo, "u2");
  await participant(repo, "p1");
  const closes = soon(3);
  const mine = await H.createStudy({ repo, principal: user("u1"), body: { title: "Survey", description: "15 min", criteria: "18+", closesAt: closes } });
  const app = (await run(H.apply, { repo, principal: user("p1"), body: applyBody(mine.json.id) })).json;
  const rate = (principal, body, now) => run(H.rateApplication, { repo, principal, params: { id: app.id }, body, now });
  const afterClose = Date.parse(closes + "T12:00:00Z") + 86400000;
  assert.equal((await rate(user("u1"), { stars: 5 })).status, 400); // still open
  assert.equal((await rate(user("u2"), { stars: 5 }, afterClose)).status, 403);
  assert.equal((await rate(user("u1"), { stars: 6 }, afterClose)).status, 400);
  assert.equal((await rate(user("u1"), { stars: 4, attended: true, comment: "Great." }, afterClose)).status, 200);
  const rows = (await run(H.studyApplicants, { repo, principal: user("u1"), params: { id: mine.json.id } })).json;
  assert.equal(rows[0].rating.stars, 4);
  assert.equal(rows[0].rating.comment, "Great.");
  // Another researcher sees the participant's score and count, never the comment
  const other = await H.createStudy({ repo, principal: user("u2"), body: { title: "Other", description: "d", criteria: "c", closesAt: soon(20) } });
  await run(H.apply, { repo, principal: user("p1"), body: applyBody(other.json.id) });
  const theirs = (await run(H.studyApplicants, { repo, principal: user("u2"), params: { id: other.json.id } })).json;
  assert.deepEqual(theirs[0].ratingSummary, { count: 1, average: 4 });
  assert.equal(theirs[0].rating, null);
  assert.ok(!JSON.stringify(theirs).includes("Great."));
  // Participants never see ratings
  assert.ok((await H.myApplications({ repo, principal: user("p1") })).json.every((x) => !("rating" in x)));
});


"use strict";
const crypto = require("node:crypto");
const V = require("./validate");
const { trendFor } = require("./trending");
const { newGroupId } = require("./ids");
const { FIELDS, POSITIONS, COUNTRY_NAMES } = require("./lists");
const { harvardAuthors } = require("./harvard");
const { HttpError, bad } = V;

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
// A study is open to applications up to and including its closing date.
const isOpen = (s, now = Date.now()) => !s.closesAt || s.closesAt >= today(now);
const ok = (json, status = 200) => ({ status, json });

function needUser(principal) {
  if (!principal) throw new HttpError(401, "Sign in to do this.");
  return principal;
}
async function myResearcher(repo, principal) {
  if (!principal) return null;
  const [r] = await repo.where("researchers", "userId", principal.userId);
  return r || null;
}
async function needResearcher(repo, principal) {
  needUser(principal);
  const r = await myResearcher(repo, principal);
  if (!r) throw new HttpError(403, "Create your researcher profile first.");
  return r;
}
// Participant profiles are keyed by a hash of the sign-in id, so the id reveals nothing about the person.
const participantId = (userId) => "p-" + crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 40);
async function myParticipant(repo, principal) {
  if (!principal) return null;
  return repo.get("participants", participantId(principal.userId));
}
const publicParticipant = ({ userId, ...p }) => p;
// Ratings are summarised per participant, across every study they have taken part in.
const participantKey = ({ userId, email }) => userId || String(email || "").toLowerCase();
function ratingSummaries(applications) {
  const totals = new Map();
  for (const a of applications) {
    if (!a.rating || a.status === "withdrawn") continue;
    const k = participantKey(a);
    const t = totals.get(k) || { count: 0, sum: 0 };
    t.count += 1; t.sum += Number(a.rating.stars) || 0;
    totals.set(k, t);
  }
  return new Map([...totals].map(([k, t]) => [k, { count: t.count, average: Math.round((t.sum / t.count) * 10) / 10 }]));
}

// What other researchers may see. Sign-in ids and pending verification codes never leave the server.
const publicResearcher = ({ userId, verification, ...r }) => r;
function canEditGroup(g, researcherId) {
  return !!researcherId && (g.ownerId === researcherId || (g.members || []).some((m) => m.researcherId === researcherId && m.canEdit));
}

/* ---------- read ---------- */
// Participant-facing data: open studies from verified researchers only, with just enough
// about who runs them, plus a trending score (no applicant numbers).
async function publicData({ repo, now = Date.now() }) {
  const [studies, researchers, groups, everyApplication] = await Promise.all([repo.all("studies"), repo.all("researchers"), repo.all("groups"), repo.all("applications")]);
  // Withdrawn applications no longer count towards reach or trending.
  const applications = everyApplication.filter((a) => a.status !== "withdrawn");
  const rById = new Map(researchers.map((r) => [r.id, r]));
  const gById = new Map(groups.map((g) => [g.id, g]));
  // Where participants are based, as counts per country. No applicant details, and no
  // per-study numbers: those stay with each study's own researcher.
  const byCountry = {};
  for (const a of applications) { const c = a.country || "Unknown"; byCountry[c] = (byCountry[c] || 0) + 1; }
  return ok({
    reach: { total: applications.length, byCountry },
    studies: studies
      .filter((s) => rById.get(s.researcherId)?.verified && isOpen(s, now))
      .map((s) => ({
        ...s,
        researcherVerified: rById.get(s.researcherId).verified,
        groupName: (s.groupId && gById.get(s.groupId)?.name) || "",
        trend: trendFor(s, applications, now),
      })),
  });
}

// Researcher-only data: the directory, group pages and recruitment counts.
async function network({ repo, principal }) {
  const me = await needResearcher(repo, principal);
  const [researchers, groups, everyApplication] = await Promise.all([repo.all("researchers"), repo.all("groups"), repo.all("applications")]);
  const applications = everyApplication.filter((a) => a.status !== "withdrawn");
  // Only aggregate counts leave the server; applicant details never do.
  const byCountry = {}, byStudy = {};
  for (const a of applications) {
    byStudy[a.studyId] = (byStudy[a.studyId] || 0) + 1;
    const c = a.country || "Unknown";
    byCountry[c] = (byCountry[c] || 0) + 1;
  }
  // A researcher's own studies, including any hidden from participants because they're not verified.
  const myStudies = (await repo.where("studies", "researcherId", me.id)).map((s) => ({ ...s, hidden: !me.verified }));
  return ok({ researchers: researchers.map(publicResearcher), groups, myStudies, stats: { total: applications.length, byCountry, byStudy } });
}

async function me({ repo, principal }) {
  if (!principal) return ok({ user: null, researcher: null, participant: null });
  const r = await myResearcher(repo, principal);
  const p = r ? null : await myParticipant(repo, principal);
  return ok({ user: { name: principal.details, provider: principal.provider }, researcher: r ? publicResearcher(r) : null, participant: p ? publicParticipant(p) : null });
}

/* ---------- researcher profile ---------- */
async function putProfile({ repo, principal, body }) {
  needUser(principal);
  const existing = await myResearcher(repo, principal);
  const b = body || {};
  const p = {
    name: V.str(b.name, "Name", { required: true, max: 120 }),
    handle: V.handle(b.handle),
    position: V.choice(b.position, "Position", POSITIONS, { required: true }),
    institution: V.str(b.institution, "Institution", { required: true, max: 160 }),
    ror: V.ror(b.ror),
    department: V.str(b.department, "Department", { max: 160 }),
    country: V.choice(b.country, "Country", COUNTRY_NAMES, { required: true }),
    field: V.choice(b.field, "Field", FIELDS, { required: true }),
    email: V.email(b.email, "Email", { required: true }),
    linkedin: V.linkedin(b.linkedin),
    scholar: V.scholar(b.scholar),
    orcid: V.orcid(b.orcid),
    bio: V.str(b.bio, "Bio", { required: true, max: 600 }),
  };
  const sameHandle = await repo.where("researchers", "handle", p.handle);
  if (sameHandle.some((r) => !existing || r.id !== existing.id)) throw new HttpError(409, `@${p.handle} is already taken. Choose another handle.`);
  const doc = { ...(existing || {}), ...p, id: existing?.id || newId(), userId: principal.userId, createdAt: existing?.createdAt || today(), updatedAt: today() };
  // Verification vouches for a specific institution, so it lapses if the institution changes.
  if (existing?.verified && existing.institution !== p.institution) delete doc.verified;
  await repo.upsert("researchers", doc);
  // Keep the researcher details shown on their studies in step with the profile.
  if (existing) {
    for (const s of await repo.where("studies", "researcherId", doc.id)) {
      await repo.upsert("studies", { ...s, researcherName: doc.name, researcherEmail: doc.email, institution: doc.institution });
    }
  }
  return ok(publicResearcher(doc), existing ? 200 : 201);
}

/* ---------- groups ---------- */
async function normalizeGroup(repo, b) {
  b = b || {};
  const year = new Date().getFullYear();
  const g = {
    name: V.str(b.name, "Group name", { required: true, max: 140 }),
    institution: V.str(b.institution, "Institution", { required: true, max: 160 }),
    country: V.choice(b.country, "Country", COUNTRY_NAMES, { required: true }),
    field: V.choice(b.field, "Field", FIELDS, { required: true }),
    founded: V.int(b.founded, "Year founded", { min: 1800, max: year }),
    email: V.email(b.email, "Contact email", { required: true }),
    website: V.url(b.website, "Website"),
    ror: V.ror(b.ror),
    rorName: V.str(b.rorName, "Institution name in ROR", { max: 200 }),
    summary: V.str(b.summary, "One-line summary", { required: true, max: 180 }),
    about: V.str(b.about, "About the group", { required: true, max: 3000 }),
    focus: V.list(b.focus, "Research focus", 12).map((f) => V.str(f, "Research focus area", { max: 40 })).filter(Boolean),
    // Citations aren't typed in: they're summed from members' OpenAlex figures when the page is drawn.
    grants: V.int(b.grants, "Active grants", { min: 0, max: 1000 }) ?? 0,
    publications: V.list(b.publications, "Publications", 200).map((raw, i) => {
      const p = raw || {};
      // Authors are entered one full name at a time and stored as a Harvard-style string.
      const authorNames = V.list(p.authorNames, `Publication ${i + 1} authors`, 30)
        .map((n, j) => V.str(n, `Publication ${i + 1}, author ${j + 1}`, { max: 120 }))
        .filter(Boolean);
      if (!authorNames.length) throw bad(`Publication ${i + 1} needs at least one author.`);
      return {
        title: V.str(p.title, `Publication ${i + 1} title`, { required: true, max: 300 }),
        authorNames,
        authors: harvardAuthors(authorNames),
        venue: V.str(p.venue, `Publication ${i + 1} journal or venue`, { required: true, max: 200 }),
        year: V.int(p.year, `Publication ${i + 1} year`, { min: 1900, max: year + 1, required: true }),
        url: V.url(p.url, `Publication ${i + 1} link`),
      };
    }),
    openings: V.list(b.openings, "Openings", 20).map((o, i) => ({
      type: V.oneOf(o.type, `Opening ${i + 1} type`, V.OPENING_TYPES, "Other"),
      title: V.str(o.title, `Opening ${i + 1} title`, { required: true, max: 160 }),
      detail: V.str(o.detail, `Opening ${i + 1} details`, { max: 600 }),
      deadline: V.date(o.deadline, `Opening ${i + 1} deadline`),
    })),
  };
  const seen = new Set(), members = [];
  for (const m of V.list(b.members, "Members", 100)) {
    const id = V.str(m.researcherId, "Member", { required: true, max: 64 });
    if (seen.has(id)) continue;
    if (!(await repo.get("researchers", id))) throw bad("Every member must be a registered researcher. Add them with @ and their name.");
    seen.add(id);
    members.push({ researcherId: id, role: V.str(m.role, "Member role", { max: 80 }) || "Member", canEdit: !!m.canEdit });
  }
  g.members = members;
  return g;
}
function ensureOwner(g, ownerId) {
  const i = g.members.findIndex((m) => m.researcherId === ownerId);
  if (i === -1) g.members.unshift({ researcherId: ownerId, role: "Group lead", canEdit: true });
  else g.members[i].canEdit = true;
  return g;
}
async function createGroup({ repo, principal, body }) {
  const me = await needResearcher(repo, principal);
  const g = ensureOwner(await normalizeGroup(repo, body), me.id);
  // Permanent public identifier, minted once and never reissued.
  let publicId = newGroupId();
  for (let i = 0; i < 5 && (await repo.where("groups", "publicId", publicId)).length; i++) publicId = newGroupId();
  const doc = { ...g, id: newId(), publicId, ownerId: me.id, createdAt: today(), updatedAt: today() };
  delete doc.citations;
  await repo.upsert("groups", doc);
  return ok(doc, 201);
}
async function updateGroup({ repo, principal, body, params }) {
  const me = await needResearcher(repo, principal);
  const existing = await repo.get("groups", params.id);
  if (!existing) throw new HttpError(404, "That group doesn't exist.");
  if (!canEditGroup(existing, me.id)) throw new HttpError(403, "Only the group's owner and members with edit access can change this page.");
  const g = ensureOwner(await normalizeGroup(repo, body), existing.ownerId);
  const doc = { ...g, id: existing.id, publicId: existing.publicId || newGroupId(), ownerId: existing.ownerId, createdAt: existing.createdAt, updatedAt: today() };
  delete doc.citations;
  await repo.upsert("groups", doc);
  return ok(doc);
}
async function deleteGroup({ repo, principal, params }) {
  const me = await needResearcher(repo, principal);
  const existing = await repo.get("groups", params.id);
  if (!existing) return ok({ deleted: true });
  if (existing.ownerId !== me.id) throw new HttpError(403, "Only the person who created the group can delete it.");
  for (const s of await repo.where("studies", "groupId", existing.id)) await repo.upsert("studies", { ...s, groupId: "" });
  await repo.remove("groups", existing.id);
  return ok({ deleted: true });
}

/* ---------- studies ---------- */
async function normalizeStudy(repo, me, b) {
  b = b || {};
  const s = {
    title: V.str(b.title, "Study title", { required: true, max: 160 }),
    field: V.choice(b.field, "Field", FIELDS) || me.field,
    country: V.choice(b.country, "Country", COUNTRY_NAMES) || me.country,
    format: V.oneOf(b.format, "Format", V.FORMATS, "Online"),
    duration: V.str(b.duration, "Time needed", { max: 120 }),
    compensation: V.str(b.compensation, "Reward", { max: 120 }),
    description: V.str(b.description, "What's involved", { required: true, max: 2000 }),
    criteria: V.str(b.criteria, "Who can take part", { required: true, max: 400 }),
    groupId: V.str(b.groupId, "Group", { max: 64 }),
    closesAt: V.date(b.closesAt, "Closing date"),
  };
  if (!s.closesAt) throw bad("Closing date is required.");
  const max = new Date(); max.setFullYear(max.getFullYear() + 1);
  if (s.closesAt < today()) throw bad("Closing date can't be in the past.");
  if (s.closesAt > max.toISOString().slice(0, 10)) throw bad("Closing date must be within a year.");
  if (s.groupId) {
    const g = await repo.get("groups", s.groupId);
    if (!g || !(g.members || []).some((m) => m.researcherId === me.id)) throw bad("You can only link a study to a group you're a member of.");
  }
  return { ...s, researcherId: me.id, researcherName: me.name, researcherEmail: me.email, institution: me.institution };
}
async function createStudy({ repo, principal, body }) {
  const me = await needResearcher(repo, principal);
  if (!me.verified) throw new HttpError(403, "Verify your institution email before posting a study. Participants only see studies from verified researchers.");
  const doc = { ...(await normalizeStudy(repo, me, body)), id: newId(), postedAt: today() };
  await repo.upsert("studies", doc);
  return ok(doc, 201);
}
async function updateStudy({ repo, principal, body, params }) {
  const me = await needResearcher(repo, principal);
  const existing = await repo.get("studies", params.id);
  if (!existing) throw new HttpError(404, "That study doesn't exist.");
  if (existing.researcherId !== me.id) throw new HttpError(403, "Only the researcher who posted this study can change it.");
  const doc = { ...(await normalizeStudy(repo, me, body)), id: existing.id, postedAt: existing.postedAt };
  await repo.upsert("studies", doc);
  return ok(doc);
}
async function deleteStudy({ repo, principal, params }) {
  const me = await needResearcher(repo, principal);
  const existing = await repo.get("studies", params.id);
  if (!existing) return ok({ deleted: true });
  if (existing.researcherId !== me.id) throw new HttpError(403, "Only the researcher who posted this study can remove it.");
  for (const a of await repo.where("applications", "studyId", existing.id)) await repo.remove("applications", a.id, a.studyId);
  await repo.remove("studies", existing.id);
  return ok({ deleted: true });
}
async function studyApplicants({ repo, principal, params }) {
  const me = await needResearcher(repo, principal);
  const s = await repo.get("studies", params.id);
  if (!s) throw new HttpError(404, "That study doesn't exist.");
  if (s.researcherId !== me.id) throw new HttpError(403, "Only the researcher running this study can see its applicants.");
  const apps = await repo.where("applications", "studyId", s.id);
  const summaries = ratingSummaries(await repo.all("applications"));
  const rows = apps.map(({ userId, rating, ...a }) => ({
    ...a,
    status: a.status || "active",
    // Other researchers' feedback is reduced to a score and a count. Comments stay with whoever wrote them.
    ratingSummary: summaries.get(participantKey({ userId, email: a.email })) || { count: 0, average: null },
    rating: rating && rating.researcherId === me.id ? { stars: rating.stars, attended: rating.attended, comment: rating.comment, ratedAt: rating.ratedAt } : null,
  }));
  return ok(rows.sort((a, b) => String(b.date).localeCompare(String(a.date))));
}

/* ---------- institution lookup ---------- */
/** Searches the Research Organization Registry so a group can attach its institution's ROR ID. */
async function rorSearch({ repo, principal, params, query, http = defaultHttp }) {
  await needResearcher(repo, principal);
  const q = V.str(query ?? params?.q, "Search", { required: true, max: 120 });
  let data;
  try { data = await http(`https://api.ror.org/v2/organizations?query=${encodeURIComponent(q)}`); }
  catch (e) { throw new HttpError(502, "Couldn't reach the ROR registry just now. Try again in a moment."); }
  const pick = (org) => {
    const names = org.names || [];
    const display = names.find((n) => (n.types || []).includes("ror_display")) || names[0] || {};
    const loc = (org.locations || [])[0] || {};
    return {
      ror: String(org.id || "").replace(/^https?:\/\/ror\.org\//, ""),
      name: display.value || "",
      country: loc.geonames_details?.country_name || "",
      city: loc.geonames_details?.name || "",
    };
  };
  return ok({ results: (data.items || []).slice(0, 6).map(pick).filter((x) => x.ror && x.name) });
}

/* ---------- publication stats ---------- */
/**
 * Publication figures come from OpenAlex (free, open, and keyed to ORCID).
 * Google Scholar has no API and forbids automated access, so a researcher's
 * Scholar profile is shown as a link only.
 */
const OPENALEX = "https://api.openalex.org";
async function fetchScholar({ repo, principal, body, http = defaultHttp, now = Date.now() }) {
  const me = await needResearcher(repo, principal);
  const orcid = V.orcid(body?.orcid ?? me.orcid);
  if (!orcid) throw bad("Add your ORCID iD first, so we look up the right person.");
  const mailto = process.env.OPENALEX_MAILTO ? `?mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO)}` : "";
  let a;
  try { a = await http(`${OPENALEX}/authors/orcid:${orcid}${mailto}`); }
  catch (e) {
    if (e && e.status === 404) throw new HttpError(404, "OpenAlex has no author with that ORCID yet. It can take a while for new records to appear.");
    throw new HttpError(502, "Couldn't reach OpenAlex just now. Try again in a moment.");
  }
  const stats = a.summary_stats || {};
  const years = (a.counts_by_year || []).filter((y) => y.year >= new Date(now).getUTCFullYear() - 2);
  const metrics = {
    source: "OpenAlex",
    authorId: String(a.id || "").replace("https://openalex.org/", ""),
    name: a.display_name || "",
    works: a.works_count || 0,
    citations: a.cited_by_count || 0,
    hIndex: stats.h_index || 0,
    i10: stats.i10_index || 0,
    recentWorks: years.reduce((n, y) => n + (y.works_count || 0), 0),
    recentCitations: years.reduce((n, y) => n + (y.cited_by_count || 0), 0),
    updatedAt: today(now),
  };
  const doc = { ...me, orcid, metrics };
  await repo.upsert("researchers", doc);
  return ok(publicResearcher(doc));
}
async function defaultHttp(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "HumAIn Labs (https://humain.example)" } });
  if (!res.ok) { const e = new Error(`OpenAlex ${res.status}`); e.status = res.status; throw e; }
  return res.json();
}

/* ---------- verification ---------- */
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "mail.com", "yandex.com", "yandex.ru", "qq.com", "163.com", "zoho.com"]);
const CODE_TTL_MS = 15 * 60 * 1000, RESEND_MS = 60 * 1000, MAX_ATTEMPTS = 5;
const hashCode = (code, salt) => crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");

async function verifyStart({ repo, principal, body, mailer, now = Date.now() }) {
  const me = await needResearcher(repo, principal);
  const email = V.email(body?.email, "Institution email", { required: true }).toLowerCase();
  const domain = email.split("@")[1];
  if (FREE_MAIL.has(domain)) throw bad("Use your institution's email address, not a personal one like Gmail or Outlook.");
  const pending = me.verification;
  if (pending?.sentAt && now - pending.sentAt < RESEND_MS) throw new HttpError(429, "A code was sent less than a minute ago. Check your inbox, or try again shortly.");
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const salt = crypto.randomBytes(8).toString("hex");
  await repo.upsert("researchers", { ...me, verification: { email, domain, salt, codeHash: hashCode(code, salt), sentAt: now, expiresAt: now + CODE_TTL_MS, attempts: 0 } });
  if (mailer) {
    await mailer.send({
      to: email,
      subject: "Your HumAIn Labs verification code",
      text: `Your HumAIn Labs verification code is ${code}. It expires in 15 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    });
    return ok({ sent: true, email });
  }
  // No email service configured (local development only): hand the code back so the flow can be tested.
  if (process.env.DEV_SHOW_CODES === "1") return ok({ sent: false, email, devCode: code });
  throw new HttpError(503, "Email isn't set up on this server yet, so verification codes can't be sent.");
}

async function verifyConfirm({ repo, principal, body, now = Date.now() }) {
  const me = await needResearcher(repo, principal);
  const v = me.verification;
  if (!v) throw bad("Ask for a verification code first.");
  if (now > v.expiresAt) throw bad("That code has expired. Ask for a new one.");
  if (v.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong codes. Ask for a new one.");
  const code = V.str(body?.code, "Code", { required: true, max: 10 }).replace(/\s/g, "");
  if (hashCode(code, v.salt) !== v.codeHash) {
    await repo.upsert("researchers", { ...me, verification: { ...v, attempts: v.attempts + 1 } });
    throw bad(`That code isn't right. ${MAX_ATTEMPTS - v.attempts - 1} tries left.`);
  }
  const { verification, ...rest } = me;
  const doc = { ...rest, verified: { method: "institution-email", domain: v.domain, at: new Date(now).toISOString().slice(0, 10) } };
  await repo.upsert("researchers", doc);
  return ok(publicResearcher(doc));
}

/* ---------- applications ---------- */
async function apply({ repo, principal, body }) {
  needUser(principal);
  const b = body || {};
  const studyId = V.str(b.studyId, "Study", { required: true, max: 64 });
  const study = await repo.get("studies", studyId);
  if (!study) throw new HttpError(404, "That study isn't open any more.");
  const owner = await repo.get("researchers", study.researcherId);
  if (!owner?.verified) throw new HttpError(404, "That study isn't open any more.");
  if (!isOpen(study)) throw new HttpError(410, "This study has closed and isn't taking applications any more.");
  if (b.consent !== true) throw bad("You need to agree to be contacted about this study.");
  if (await myResearcher(repo, principal)) throw new HttpError(403, "Researcher accounts can't apply to studies. Sign in with a separate participant account to take part.");
  // Name, email, age and country come from the participant profile, so they are entered once, not per study.
  const profile = await repo.get("participants", participantId(principal.userId));
  if (!profile) throw new HttpError(412, "Set up your participant profile first. You only do this once, then you can apply to any study.");
  const mine = await repo.where("applications", "userId", principal.userId);
  if (mine.some((a) => a.studyId === studyId)) throw new HttpError(409, "You've already applied to this study.");
  const doc = {
    id: newId(), studyId, userId: principal.userId,
    name: profile.name, email: profile.email, age: String(profile.age), country: profile.country,
    notes: V.str(b.notes, "Notes", { max: 1000 }),
    date: today(),
    status: "active",
  };
  await repo.upsert("applications", doc);
  const { userId, ...out } = doc;
  return ok(out, 201);
}
async function myApplications({ repo, principal }) {
  needUser(principal);
  const mine = await repo.where("applications", "userId", principal.userId);
  // Ratings are for researchers only, so they never come back to the participant.
  return ok(mine.map(({ userId, rating, ...a }) => ({ status: "active", ...a })));
}

/* ---------- participant profile ---------- */
// Set up once after signing in. Applications copy these details, so nobody retypes them for each study.
async function putParticipant({ repo, principal, body }) {
  needUser(principal);
  if (await myResearcher(repo, principal)) throw new HttpError(403, "Researcher accounts don't take part in studies, so they don't need a participant profile.");
  const b = body || {};
  const id = participantId(principal.userId);
  const existing = await repo.get("participants", id);
  const doc = {
    id, userId: principal.userId,
    name: V.str(b.name, "Full name", { required: true, max: 120 }),
    email: V.email(b.email, "Email", { required: true }),
    age: V.int(b.age, "Age", { min: 16, max: 120, required: true }),
    country: V.choice(b.country, "Country", COUNTRY_NAMES, { required: true }),
    createdAt: existing?.createdAt || today(),
    updatedAt: today(),
  };
  await repo.upsert("participants", doc);
  return ok(publicParticipant(doc), existing ? 200 : 201);
}

/* ---------- withdrawal and ratings ---------- */
// A participant can withdraw up to the end of the day before the study's closing date.
async function withdrawApplication({ repo, principal, params, now = Date.now() }) {
  needUser(principal);
  const [a] = await repo.where("applications", "id", params.id);
  if (!a || a.userId !== principal.userId) throw new HttpError(404, "That application doesn't exist.");
  if (a.status === "withdrawn") throw new HttpError(409, "You've already withdrawn from this study.");
  const s = await repo.get("studies", a.studyId);
  if (!s?.closesAt || today(now) >= s.closesAt) throw new HttpError(410, "Withdrawal closes the day before this study's deadline, so it's too late to withdraw.");
  const withdrawnAt = today(now);
  await repo.upsert("applications", { ...a, status: "withdrawn", withdrawnAt });
  return ok({ id: a.id, status: "withdrawn", withdrawnAt });
}

// Researchers rate each participant once their study has closed. The rating and comment are private to the researcher.
async function rateApplication({ repo, principal, params, body, now = Date.now() }) {
  const me = await needResearcher(repo, principal);
  const [a] = await repo.where("applications", "id", params.id);
  if (!a) throw new HttpError(404, "That application doesn't exist.");
  const s = await repo.get("studies", a.studyId);
  if (!s || s.researcherId !== me.id) throw new HttpError(403, "Only the researcher running this study can rate its participants.");
  if (isOpen(s, now)) throw bad("You can rate participants once the study has closed.");
  if (a.status === "withdrawn") throw bad("Participants who withdrew can't be rated.");
  const b = body || {};
  const rating = {
    stars: V.int(b.stars, "Rating", { min: 1, max: 5, required: true }),
    attended: b.attended === true ? true : b.attended === false ? false : null,
    comment: V.str(b.comment, "Comment", { max: 1000 }),
    researcherId: me.id,
    ratedAt: today(now),
  };
  await repo.upsert("applications", { ...a, rating });
  return ok({ stars: rating.stars, attended: rating.attended, comment: rating.comment, ratedAt: rating.ratedAt });
}

module.exports = {
  publicData, network, me, verifyStart, verifyConfirm, fetchScholar, rorSearch, putProfile, createGroup, updateGroup, deleteGroup,
  createStudy, updateStudy, deleteStudy, studyApplicants, apply, myApplications, canEditGroup,
  putParticipant, withdrawApplication, rateApplication,
};

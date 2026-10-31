// Three interchangeable backends, picked automatically at startup:
//  - Azure: the /api functions in this project (Static Web Apps + Cosmos DB)
//  - Claude: the shared database a published claude.ai artifact provides
//  - Local: this browser's storage, with demo content (for opening the file on its own)
// The Azure API enforces the rules on the server; the other two check them here.
import { S, AUTH, COLS, computeStats, notify } from "./store.js";
import { FREE_MAIL, UserError, newGroupId, today, uid } from "./util.js";
import { harvardAuthors } from "./harvard.js";
import DEMO from "../data/seed.json";

let onToast = () => {};
export const setToaster = (fn) => (onToast = fn);

// Publications are entered as a list of author names; the saved string is the Harvard form.
const withHarvard = (g) => ({
  ...g,
  publications: (g.publications || []).map((p) => ({ ...p, authors: harvardAuthors((p.authorNames || []).map((n) => n.trim()).filter(Boolean)) })),
});
// Ratings are averaged per participant across all their studies, as the server does.
const participantKey = (a) => a.userId || String(a.email || "").toLowerCase();
function ratingSummaries(apps) {
  const totals = new Map();
  for (const a of apps) {
    if (!a.rating || a.status === "withdrawn") continue;
    const k = participantKey(a);
    const t = totals.get(k) || { count: 0, sum: 0 };
    t.count += 1;
    t.sum += Number(a.rating.stars) || 0;
    totals.set(k, t);
  }
  return new Map([...totals].map(([k, t]) => [k, { count: t.count, average: Math.round((t.sum / t.count) * 10) / 10 }]));
}

function docBackend(store, kind) {
  const SESSION_KEY = "humain-labs-session";
  let session = null;
  let pendingVerify = null;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch (e) {}

  const mine = () => (session ? S.researchers.find((r) => r.userId === session.userId) || null : null);
  const myParticipant = () => (session ? S.participants.find((p) => p.userId === session.userId) || null : null);
  const needResearcher = () => {
    if (!session) throw new UserError("Sign in to do this.");
    const r = mine();
    if (!r) throw new UserError("Create your researcher profile first.");
    return r;
  };
  const canEdit = (g, rid) => !!rid && (g.ownerId === rid || (g.members || []).some((m) => m.researcherId === rid && m.canEdit));
  const ensureOwner = (members, ownerId) => {
    const list = members.map((m) => ({ ...m }));
    const i = list.findIndex((m) => m.researcherId === ownerId);
    if (i === -1) list.unshift({ researcherId: ownerId, role: "Group lead", canEdit: true });
    else list[i].canEdit = true;
    return list;
  };
  const isVisibleHere = (s) => !s.hidden && !!(S.researchers.find((r) => r.id === s.researcherId)?.verified) && (!s.closesAt || s.closesAt >= today());

  const self = {
    kind,
    async init() {
      await store.start(() => {
        computeStats();
        self.syncAuth();
        notify();
      });
      computeStats();
      self.syncAuth();
    },
    syncAuth() {
      AUTH.user = session ? { name: session.name, email: session.email } : null;
      AUTH.researcher = mine();
      AUTH.participant = myParticipant();
      S.myApps = session ? S.applications.filter((a) => a.userId === session.userId) : [];
    },
    async refreshMe() {
      self.syncAuth();
      notify();
    },
    demoSignIn(name, email) {
      session = { userId: "demo:" + email.toLowerCase(), name, email };
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (e) {}
      self.syncAuth();
      notify();
    },
    signOut() {
      session = null;
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
      self.syncAuth();
      notify();
    },
    async saveProfile(p) {
      if (!session) throw new UserError("Sign in to do this.");
      const existing = mine();
      if (S.researchers.some((r) => r.handle === p.handle && (!existing || r.id !== existing.id)))
        throw new UserError(`@${p.handle} is already taken. Choose another handle.`);
      const doc = { ...(existing || {}), ...p, id: existing?.id || uid(), userId: session.userId, createdAt: existing?.createdAt || today(), updatedAt: today() };
      // Verification vouches for one institution, so it lapses if the institution changes.
      if (existing?.verified && existing.institution !== p.institution) delete doc.verified;
      await store.put("researchers", doc);
      if (existing)
        for (const s of S.studies.filter((s) => s.researcherId === doc.id))
          await store.put("studies", { ...s, researcherName: doc.name, researcherEmail: doc.email, institution: doc.institution });
      return doc;
    },
    async saveGroup(g0, id) {
      const g = withHarvard(g0);
      const me = needResearcher();
      if (g.members.some((m) => !S.researchers.some((r) => r.id === m.researcherId)))
        throw new UserError("Every member must be a registered researcher.");
      if (id) {
        const ex = S.groups.find((x) => x.id === id);
        if (!ex) throw new UserError("That group doesn't exist.");
        if (!canEdit(ex, me.id)) throw new UserError("Only the group's owner and members with edit access can change this page.");
        const doc = { ...g, members: ensureOwner(g.members, ex.ownerId), id, publicId: ex.publicId || newGroupId(), ownerId: ex.ownerId, createdAt: ex.createdAt, updatedAt: today() };
        await store.put("groups", doc);
        return doc;
      }
      const doc = { ...g, members: ensureOwner(g.members, me.id), id: uid(), publicId: newGroupId(), ownerId: me.id, createdAt: today(), updatedAt: today() };
      await store.put("groups", doc);
      return doc;
    },
    async deleteGroup(id) {
      const me = needResearcher();
      const ex = S.groups.find((x) => x.id === id);
      if (!ex) return;
      if (ex.ownerId !== me.id) throw new UserError("Only the person who created the group can delete it.");
      for (const s of S.studies.filter((s) => s.groupId === id)) await store.put("studies", { ...s, groupId: "" });
      await store.del("groups", id);
    },
    async saveStudy(s, id) {
      const me = needResearcher();
      if (!id && !me.verified) throw new UserError("Verify your institution email before posting a study.");
      if (!s.closesAt) throw new UserError("Closing date is required.");
      if (s.closesAt < today()) throw new UserError("Closing date can't be in the past.");
      if (s.groupId && !S.groups.some((g) => g.id === s.groupId && g.members.some((m) => m.researcherId === me.id)))
        throw new UserError("You can only link a study to a group you're a member of.");
      const base = { ...s, researcherId: me.id, researcherName: me.name, researcherEmail: me.email, institution: me.institution };
      if (id) {
        const ex = S.studies.find((x) => x.id === id);
        if (!ex || ex.researcherId !== me.id) throw new UserError("Only the researcher who posted this study can change it.");
        const doc = { ...base, id, postedAt: ex.postedAt };
        await store.put("studies", doc);
        return doc;
      }
      const doc = { ...base, id: uid(), postedAt: today() };
      await store.put("studies", doc);
      return doc;
    },
    async deleteStudy(id) {
      const me = needResearcher();
      const ex = S.studies.find((x) => x.id === id);
      if (!ex) return;
      if (ex.researcherId !== me.id) throw new UserError("Only the researcher who posted this study can remove it.");
      for (const a of S.applications.filter((a) => a.studyId === id)) await store.del("applications", a.id);
      await store.del("studies", id);
    },
    async rorSearch(q) {
      needResearcher();
      let d;
      try {
        const res = await fetch(`https://api.ror.org/v2/organizations?query=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("bad status");
        d = await res.json();
      } catch (e) {
        throw new UserError("Couldn't reach the ROR registry from this preview. On the deployed site the server looks it up.");
      }
      return (d.items || [])
        .slice(0, 6)
        .map((o) => {
          const names = o.names || [];
          const display = names.find((n) => (n.types || []).includes("ror_display")) || names[0] || {};
          const loc = (o.locations || [])[0] || {};
          return {
            ror: String(o.id || "").replace(/^https?:\/\/ror\.org\//, ""),
            name: display.value || "",
            country: loc.geonames_details?.country_name || "",
            city: loc.geonames_details?.name || "",
          };
        })
        .filter((x) => x.ror && x.name);
    },
    async fetchScholar(orcid) {
      const me = needResearcher();
      const id = String(orcid || me.orcid || "").replace(/^https?:\/\/orcid\.org\//i, "").trim();
      if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id)) throw new UserError("ORCID iD looks like 0000-0002-1825-0097.");
      let a;
      try {
        const res = await fetch(`https://api.openalex.org/authors/orcid:${id}`, { headers: { Accept: "application/json" } });
        if (res.status === 404) throw new UserError("OpenAlex has no author with that ORCID yet.");
        if (!res.ok) throw new Error("bad status");
        a = await res.json();
      } catch (e) {
        if (e instanceof UserError) throw e;
        throw new UserError("Couldn't reach OpenAlex from this preview. On the deployed site the server fetches these figures.");
      }
      const st = a.summary_stats || {};
      const yr = new Date().getFullYear();
      const years = (a.counts_by_year || []).filter((y) => y.year >= yr - 2);
      const metrics = {
        source: "OpenAlex",
        authorId: String(a.id || "").replace("https://openalex.org/", ""),
        name: a.display_name || "",
        works: a.works_count || 0,
        citations: a.cited_by_count || 0,
        hIndex: st.h_index || 0,
        i10: st.i10_index || 0,
        recentWorks: years.reduce((n, y) => n + (y.works_count || 0), 0),
        recentCitations: years.reduce((n, y) => n + (y.cited_by_count || 0), 0),
        updatedAt: today(),
      };
      const doc = { ...me, orcid: id.toUpperCase(), metrics };
      await store.put("researchers", doc);
      return doc;
    },
    async verifyStart(email) {
      const me = needResearcher();
      email = String(email || "").trim().toLowerCase();
      const domain = email.split("@")[1] || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Enter a valid email address.");
      if (FREE_MAIL.has(domain)) throw new UserError("Use your institution's email address, not a personal one like Gmail or Outlook.");
      pendingVerify = { id: me.id, email, domain, code: String(Math.floor(Math.random() * 1e6)).padStart(6, "0"), expires: Date.now() + 15 * 60 * 1000, attempts: 0 };
      return { email, devCode: pendingVerify.code };
    },
    async verifyConfirm(code) {
      const me = needResearcher();
      const v = pendingVerify;
      if (!v || v.id !== me.id) throw new UserError("Ask for a verification code first.");
      if (Date.now() > v.expires) throw new UserError("That code has expired. Ask for a new one.");
      if (v.attempts >= 5) throw new UserError("Too many wrong codes. Ask for a new one.");
      if (String(code).replace(/\s/g, "") !== v.code) {
        v.attempts++;
        throw new UserError(`That code isn't right. ${5 - v.attempts} tries left.`);
      }
      pendingVerify = null;
      const doc = { ...me, verified: { method: "institution-email", domain: v.domain, at: today() } };
      await store.put("researchers", doc);
      return doc;
    },
    async saveParticipant(p) {
      if (!session) throw new UserError("Sign in to do this.");
      if (mine()) throw new UserError("Researcher accounts don't take part in studies, so they don't need a participant profile.");
      const existing = myParticipant();
      const doc = {
        ...(existing || {}), id: existing?.id || uid(), userId: session.userId,
        name: p.name, email: p.email, age: Number(p.age), country: p.country,
        createdAt: existing?.createdAt || today(), updatedAt: today(),
      };
      await store.put("participants", doc);
      return doc;
    },
    async apply(a) {
      if (!session) throw new UserError("Sign in to apply.");
      if (mine()) throw new UserError("Researcher accounts can't apply to studies. Sign in with a separate participant account to take part.");
      const part = myParticipant();
      if (!part) throw new UserError("Set up your participant details first. You only do this once.");
      const st = S.studies.find((x) => x.id === a.studyId);
      if (!st || !isVisibleHere(st)) throw new UserError("That study isn't open any more.");
      if (S.applications.some((x) => x.studyId === a.studyId && x.userId === session.userId)) throw new UserError("You've already applied to this study.");
      // Details come from the participant profile, so each application keeps the details it was sent with.
      const doc = {
        id: uid(), studyId: a.studyId, userId: session.userId,
        name: part.name, email: part.email, age: String(part.age), country: part.country,
        notes: String(a.notes || "").slice(0, 1000), date: today(), status: "active",
      };
      await store.put("applications", doc);
      return doc;
    },
    async withdraw(id) {
      if (!session) throw new UserError("Sign in to do this.");
      const ex = S.applications.find((x) => x.id === id && x.userId === session.userId);
      if (!ex) throw new UserError("That application doesn't exist.");
      if (ex.status === "withdrawn") throw new UserError("You've already withdrawn from this study.");
      const st = S.studies.find((x) => x.id === ex.studyId);
      if (!st?.closesAt || today() >= st.closesAt) throw new UserError("Withdrawal closes the day before this study's deadline, so it's too late to withdraw.");
      const doc = { ...ex, status: "withdrawn", withdrawnAt: today() };
      await store.put("applications", doc);
      return doc;
    },
    async rate(id, body) {
      const me = needResearcher();
      const ex = S.applications.find((x) => x.id === id);
      if (!ex) throw new UserError("That application doesn't exist.");
      const st = S.studies.find((x) => x.id === ex.studyId);
      if (!st || st.researcherId !== me.id) throw new UserError("Only the researcher running this study can rate its participants.");
      if (!st.closesAt || st.closesAt >= today()) throw new UserError("You can rate participants once the study has closed.");
      if (ex.status === "withdrawn") throw new UserError("Participants who withdrew can't be rated.");
      const stars = Number(body?.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new UserError("Pick a rating from 1 to 5 stars.");
      const rating = {
        stars, attended: body.attended === true ? true : body.attended === false ? false : null,
        comment: String(body.comment || "").slice(0, 1000), researcherId: me.id, ratedAt: today(),
      };
      await store.put("applications", { ...ex, rating });
      return rating;
    },
    async applicants(studyId) {
      const me = needResearcher();
      const s = S.studies.find((x) => x.id === studyId);
      if (!s || s.researcherId !== me.id) throw new UserError("Only the researcher running this study can see its applicants.");
      const summaries = ratingSummaries(S.applications);
      return S.applications
        .filter((a) => a.studyId === studyId)
        .map(({ userId, rating, ...a }) => ({
          ...a,
          status: a.status || "active",
          ratingSummary: summaries.get(participantKey({ userId, email: a.email })) || { count: 0, average: null },
          rating: rating && rating.researcherId === me.id ? rating : null,
        }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    },
  };
  return self;
}

function localStore(demo) {
  const KEY = "humain-labs-data-v2";
  let changed = () => {};
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(COLS.map((c) => [c, S[c]]))));
    } catch (e) {}
  };
  return {
    async start(onChange) {
      changed = onChange;
      let data = null;
      try {
        data = JSON.parse(localStorage.getItem(KEY) || "null");
      } catch (e) {}
      data = data || JSON.parse(JSON.stringify(demo));
      COLS.forEach((c) => (S[c] = data[c] || []));
    },
    async put(col, doc) {
      if (col === "applications") S.appsVersion += 1;
      const i = S[col].findIndex((d) => d.id === doc.id);
      if (i === -1) S[col] = [...S[col], doc];
      else {
        S[col] = S[col].slice();
        S[col][i] = doc;
      }
      save();
      changed();
    },
    async del(col, id) {
      S[col] = S[col].filter((d) => d.id !== id);
      save();
      changed();
    },
  };
}

function claudeStore(db) {
  const wrap = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      const code = e && e.code;
      if (code === "unavailable") {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        return fn();
      }
      if (code === "invalid_argument") throw new UserError("You have view-only access to this page, so this can't be saved.");
      if (code === "quota_exceeded") throw new UserError("The database is full. Remove some old entries before adding more.");
      throw new UserError("That couldn't be saved. Try again in a moment.");
    }
  };
  return {
    start(onChange) {
      return new Promise((resolve) => {
        const seen = new Set();
        COLS.forEach((c) =>
          db.collection(c).onSnapshot(
            (snap) => {
              S[c] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
              if (!seen.has(c)) {
                seen.add(c);
                if (seen.size === COLS.length) resolve();
              } else onChange();
              if (seen.size === COLS.length) onChange();
            },
            () => onToast("Live updates stopped. Reload the page to reconnect.")
          )
        );
      });
    },
    put: (col, doc) => {
      const body = { ...doc };
      delete body.id;
      return wrap(() => db.collection(col).doc(doc.id).set(body));
    },
    del: (col, id) => wrap(() => db.collection(col).doc(id).delete()),
  };
}

function azureBackend() {
  async function api(method, path, body) {
    let res;
    try {
      res = await fetch("/api/" + path, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch (e) {
      throw new UserError("Couldn't reach the server. Check your connection and try again.");
    }
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) throw new UserError(data?.error || (res.status === 401 ? "Sign in to do this." : "Something went wrong. Try again in a moment."));
    return data;
  }
  const appCache = {};
  let publicStudies = [];
  const self = {
    kind: "azure",
    async init() {
      await self.reload();
      await self.refreshMe();
    },
    // Everyone gets the open studies and the country counts. The directory, groups and
    // per-study numbers only load for researchers.
    async reload() {
      const d = await api("GET", "public");
      publicStudies = d.studies;
      S.studies = publicStudies;
      S.stats = { ...(d.reach || { total: 0, byCountry: {} }), byStudy: S.stats.byStudy || {} };
      Object.keys(appCache).forEach((k) => delete appCache[k]);
      S.appsVersion += 1;
    },
    async refreshMe() {
      const d = await api("GET", "me");
      AUTH.user = d.user ? { name: d.user.name, email: /@/.test(d.user.name) ? d.user.name : "" } : null;
      AUTH.researcher = d.researcher;
      AUTH.participant = d.participant || null;
      if (AUTH.researcher) {
        const n = await api("GET", "network");
        S.researchers = n.researchers;
        S.groups = n.groups;
        S.stats = n.stats;
        S.myApps = [];
        const ids = new Set(publicStudies.map((s) => s.id));
        S.studies = [...publicStudies, ...(n.myStudies || []).filter((s) => !ids.has(s.id))];
      } else {
        S.studies = publicStudies;
        S.researchers = [];
        S.groups = [];
        S.myApps = AUTH.user ? await api("GET", "applications/mine").catch(() => []) : [];
      }
      notify();
    },
    signOut() {
      location.href = "/.auth/logout?post_logout_redirect_uri=" + encodeURIComponent("/" + location.hash);
    },
    async after() {
      await self.reload();
      await self.refreshMe();
    },
    async saveProfile(p) {
      const r = await api("PUT", "profile", p);
      await self.after();
      return r;
    },
    async saveGroup(g, id) {
      const r = await api(id ? "PUT" : "POST", id ? "groups/" + encodeURIComponent(id) : "groups", g);
      await self.after();
      return r;
    },
    async deleteGroup(id) {
      await api("DELETE", "groups/" + encodeURIComponent(id));
      await self.after();
    },
    async saveStudy(s, id) {
      const r = await api(id ? "PUT" : "POST", id ? "studies/" + encodeURIComponent(id) : "studies", s);
      await self.after();
      return r;
    },
    async deleteStudy(id) {
      await api("DELETE", "studies/" + encodeURIComponent(id));
      await self.after();
    },
    async rorSearch(q) {
      return (await api("GET", "ror?q=" + encodeURIComponent(q))).results;
    },
    async fetchScholar(orcid) {
      const r = await api("POST", "profile/scholar", orcid ? { orcid } : {});
      await self.after();
      return r;
    },
    async verifyStart(email) {
      return api("POST", "verification/start", { email });
    },
    async verifyConfirm(code) {
      const r = await api("POST", "verification/confirm", { code });
      await self.after();
      return r;
    },
    async apply(a) {
      const r = await api("POST", "applications", a);
      await self.after();
      return r;
    },
    async applicants(studyId) {
      return (appCache[studyId] ||= await api("GET", "studies/" + encodeURIComponent(studyId) + "/applications"));
    },
    async saveParticipant(p) {
      const r = await api("PUT", "participant", p);
      await self.after();
      return r;
    },
    async withdraw(id) {
      const r = await api("POST", "applications/" + encodeURIComponent(id) + "/withdraw");
      await self.after();
      return r;
    },
    async rate(id, body) {
      const r = await api("PUT", "applications/" + encodeURIComponent(id) + "/rating", body);
      await self.after();
      return r;
    },
  };
  return self;
}

export async function pickBackend() {
  if (window.claude && typeof window.claude.use === "function") {
    const db = await Promise.race([window.claude.use("db").catch(() => null), new Promise((r) => setTimeout(() => r(null), 12000))]);
    if (db) return docBackend(claudeStore(db), "claude");
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch("/api/health", { cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    if (r.ok && (await r.json()).backend === "azure") return azureBackend();
  } catch (e) {}
  return docBackend(localStore(DEMO), "local");
}

export const fallbackBackend = () => docBackend(localStore(DEMO), "local");

// The store: one module-level copy of the data, with React subscribing through
// useSyncExternalStore. The backends below write into it and call notify().
import { useSyncExternalStore } from "react";
import { normCountry } from "./util.js";

// appsVersion moves whenever applications change, so the applicants table reloads.
export const S = { researchers: [], participants: [], groups: [], studies: [], applications: [], myApps: [], appsVersion: 0, stats: { total: 0, byCountry: {}, byStudy: {} } };
export const AUTH = { user: null, researcher: null, participant: null };
export const COLS = ["researchers", "participants", "studies", "groups", "applications"];

let version = 0;
const listeners = new Set();
export function notify() {
  version += 1;
  listeners.forEach((l) => l());
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

/** Subscribe a component to every change in the store. */
export function useStore() {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function computeStats() {
  const byCountry = {};
  const byStudy = {};
  S.applications.forEach((a) => {
    byStudy[a.studyId] = (byStudy[a.studyId] || 0) + 1;
    const c = normCountry(a.country) || "Unknown";
    byCountry[c] = (byCountry[c] || 0) + 1;
  });
  S.stats = { total: S.applications.length, byCountry, byStudy };
}

/* ---------- derived reads, used all over the pages ---------- */
export const byId = (col, id) => S[col].find((x) => x.id === id);
export const role = () => (AUTH.researcher ? "researcher" : AUTH.user ? "participant" : "guest");
export const studyVerified = (s) => (S.researchers.length ? byId("researchers", s.researcherId)?.verified : s.researcherVerified) || null;
export const studyGroupName = (s) => (s.groupId && (byId("groups", s.groupId)?.name || s.groupName)) || "";
export const groupStudies = (g) => S.studies.filter((s) => s.groupId === g.id);
export const groupsOf = (rid) => S.groups.filter((g) => (g.members || []).some((m) => m.researcherId === rid));
export const memberResearchers = (g) => (g.members || []).map((m) => ({ ...m, r: byId("researchers", m.researcherId) })).filter((m) => m.r);
export const applied = (studyId) => S.myApps.some((a) => a.studyId === studyId);
export const appCount = (studyId) => S.stats.byStudy[studyId] || 0;
export const canEditGroup = (g) => {
  const rid = AUTH.researcher?.id;
  return !!rid && (g.ownerId === rid || (g.members || []).some((m) => m.researcherId === rid && m.canEdit));
};

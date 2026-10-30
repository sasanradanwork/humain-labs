// Shared helpers: dates, countries, identifiers, trending and the small bits of maths
// the charts need. No React in here, so the same code runs in tests.

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 16);
export const today = () => new Date().toISOString().slice(0, 10);
export const DAY_MS = 86400000;

export function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
export const fmtDate = (d) => {
  if (!d) return "";
  const x = new Date(d + "T00:00:00");
  return isNaN(x) ? d : x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const makeHandle = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/^(dr|prof|professor)\.?\s+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
export const sortName = (n) => String(n).replace(/^(Dr|Prof|Professor)\.?\s+/i, "");
export const initials = (name) =>
  sortName(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export const matches = (q, parts) => !q || parts.join(" ").toLowerCase().includes(q.trim().toLowerCase());

export class UserError extends Error {}

export const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "gmx.de", "mail.com", "yandex.com", "yandex.ru", "qq.com", "163.com", "zoho.com",
]);

/* ---------- countries: ISO code for the map, and a rough centre point for markers ---------- */
export const COUNTRIES = {
  Argentina: ["AR", -38.4, -63.6], Australia: ["AU", -25.3, 133.8], Bangladesh: ["BD", 23.7, 90.4], Belgium: ["BE", 50.5, 4.5],
  Brazil: ["BR", -14.2, -51.9], Canada: ["CA", 56.1, -106.3], Chile: ["CL", -35.7, -71.5], China: ["CN", 35.9, 104.2],
  Colombia: ["CO", 4.6, -74.3], Denmark: ["DK", 56.3, 9.5], Egypt: ["EG", 26.8, 30.8], Ethiopia: ["ET", 9.1, 40.5],
  Finland: ["FI", 61.9, 25.7], France: ["FR", 46.2, 2.2], Germany: ["DE", 51.2, 10.5], Ghana: ["GH", 7.9, -1.0],
  Greece: ["GR", 39.1, 21.8], India: ["IN", 20.6, 79.0], Indonesia: ["ID", -0.8, 113.9], Ireland: ["IE", 53.1, -7.7],
  Italy: ["IT", 41.9, 12.6], Japan: ["JP", 36.2, 138.3], Kenya: ["KE", 0.0, 37.9], Malaysia: ["MY", 4.2, 101.9],
  Mexico: ["MX", 23.6, -102.6], Morocco: ["MA", 31.8, -7.1], Netherlands: ["NL", 52.1, 5.3], "New Zealand": ["NZ", -40.9, 174.9],
  Nigeria: ["NG", 9.1, 8.7], Norway: ["NO", 60.5, 8.5], Pakistan: ["PK", 30.4, 69.3], Peru: ["PE", -9.2, -75.0],
  Philippines: ["PH", 12.9, 121.8], Poland: ["PL", 51.9, 19.1], Portugal: ["PT", 39.4, -8.2], "Saudi Arabia": ["SA", 23.9, 45.1],
  Singapore: ["SG", 1.35, 103.8], "South Africa": ["ZA", -30.6, 22.9], "South Korea": ["KR", 35.9, 127.8], Spain: ["ES", 40.5, -3.7],
  Sweden: ["SE", 60.1, 18.6], Switzerland: ["CH", 46.8, 8.2], Tanzania: ["TZ", -6.4, 34.9], Thailand: ["TH", 15.9, 100.99],
  Turkey: ["TR", 39.0, 35.2], Uganda: ["UG", 1.4, 32.3], Ukraine: ["UA", 48.4, 31.2], "United Arab Emirates": ["AE", 23.4, 53.8],
  "United Kingdom": ["GB", 55.4, -3.4], "United States": ["US", 37.1, -95.7], Vietnam: ["VN", 14.1, 108.3],
};
const COUNTRY_ALIASES = {
  uk: "United Kingdom", england: "United Kingdom", scotland: "United Kingdom", wales: "United Kingdom",
  usa: "United States", us: "United States", uae: "United Arab Emirates", korea: "South Korea", holland: "Netherlands",
};
export function countryInfo(name) {
  if (!name) return null;
  const n = String(name).trim();
  const key = Object.keys(COUNTRIES).find((k) => k.toLowerCase() === n.toLowerCase()) || COUNTRY_ALIASES[n.toLowerCase()];
  return key ? { name: key, iso: COUNTRIES[key][0], lat: COUNTRIES[key][1], lng: COUNTRIES[key][2] } : null;
}
export const normCountry = (c) => countryInfo(c)?.name || String(c || "").trim();

/* ---------- group identifiers: same scheme as api/src/lib/ids.js ---------- */
const GID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GID_CHECK = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function gidCheckChar(body) {
  let p = 36;
  for (const ch of body) {
    const v = GID_CHECK.indexOf(ch);
    if (v === -1) return "";
    p = (((p + v) % 36 || 36) * 2) % 37;
  }
  return GID_CHECK[(37 - p) % 36];
}
export function newGroupId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let body = "";
  for (const b of bytes) body += GID_ALPHABET[b % 32];
  const raw = body + gidCheckChar(body);
  return `HLG-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
export const gidKey = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

/* ---------- studies: closing dates and trending ---------- */
export const daysLeft = (s) =>
  s.closesAt ? Math.round((Date.parse(s.closesAt + "T00:00:00") - Date.parse(today() + "T00:00:00")) / DAY_MS) : null;
export const isOpen = (s) => !s.closesAt || s.closesAt >= today();

// Same scoring as api/src/lib/trending.js, for when the page holds the data itself.
export function trendFor(study, applications, now = Date.now()) {
  const weekly = new Array(8).fill(0);
  let score = 0;
  for (const a of applications) {
    if (a.studyId !== study.id) continue;
    const age = Math.max(0, (now - Date.parse(a.date + "T12:00:00Z")) / DAY_MS);
    score += Math.pow(0.5, age / 10);
    const w = Math.floor(age / 7);
    if (w < 8) weekly[7 - w] += 1;
  }
  const postedAge = (now - Date.parse(study.postedAt + "T12:00:00Z")) / DAY_MS;
  const isNew = postedAge >= 0 && postedAge <= 14;
  if (isNew) score += 1.5;
  const recent = weekly[7] + weekly[6];
  const before = weekly[5] + weekly[4];
  const max = Math.max(1, ...weekly);
  return { score, weekly: weekly.map((n) => n / max), isNew, rising: recent > 0 && recent > before };
}

/* ---------- publication figures: the radar's axes and scaling ---------- */
export const RADAR_AXES = [
  ["Publications", "works", 60],
  ["Citations", "citations", 1200],
  ["h-index", "hIndex", 15],
  ["i10-index", "i10", 40],
  ["Last 3 years", "recentWorks", 10],
];
export const radarScale = (v, top) => Math.max(0, Math.min(1, Math.sqrt(Math.max(0, v || 0) / Math.max(1, top))));

export const OPENING_TYPES = ["PhD position", "Postdoc", "Research assistant", "Collaborator", "Other"];
export const ROLE_SUGGESTIONS = [
  "Group lead", "Co-lead", "Professor", "Associate professor", "Assistant professor", "Research fellow",
  "Postdoctoral researcher", "PhD candidate", "Research assistant", "Collaborator", "Lab manager",
];
export const FORMATS = ["Online", "In person", "Hybrid"];

"use strict";
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

function str(v, name, { required = false, max = 500 } = {}) {
  const s = v == null ? "" : String(v).trim();
  if (required && !s) throw bad(`${name} is required.`);
  if (s.length > max) throw bad(`${name} must be ${max} characters or fewer.`);
  return s;
}
function int(v, name, { min = 0, max = 1e9, required = false } = {}) {
  if (v === "" || v == null) { if (required) throw bad(`${name} is required.`); return null; }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}.`);
  return n;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function email(v, name, opts = {}) {
  const s = str(v, name, { ...opts, max: 254 });
  if (s && !EMAIL.test(s)) throw bad(`${name} must be a valid email address.`);
  return s;
}
function url(v, name) {
  const s = str(v, name, { max: 500 });
  if (!s) return "";
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw bad(`${name} must start with http:// or https://`);
  return s;
}
function linkedin(v) {
  const s = url(v, "LinkedIn URL");
  if (s && !/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|pub|company)\/[^\s]+$/i.test(s)) throw bad("LinkedIn URL must be a linkedin.com/in/… profile link.");
  return s;
}
function orcid(v) {
  const s = str(v, "ORCID iD", { max: 60 }).replace(/^https?:\/\/orcid\.org\//i, "").trim();
  if (!s) return "";
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(s)) throw bad("ORCID iD looks like 0000-0002-1825-0097.");
  return s.toUpperCase();
}
function scholar(v) {
  const s = url(v, "Google Scholar profile");
  if (s && !/^https?:\/\/scholar\.google\.[a-z.]+\/citations\?user=[\w-]+/i.test(s)) throw bad("Google Scholar link should look like https://scholar.google.com/citations?user=…");
  return s;
}
function ror(v) {
  const s = str(v, "ROR ID", { max: 60 }).replace(/^https?:\/\/(www\.)?ror\.org\//i, "").trim().toLowerCase();
  if (!s) return "";
  if (!/^0[0-9a-hj-km-np-tv-z]{6}[0-9]{2}$/.test(s)) throw bad("A ROR ID looks like 027m9bs27, or the full https://ror.org/027m9bs27 link.");
  return s;
}
function date(v, name) {
  const s = str(v, name, { max: 10 });
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad(`${name} must be a date (YYYY-MM-DD).`);
  return s;
}
function handle(v) {
  const s = str(v, "Handle", { required: true, max: 40 }).toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)) throw bad("Handle can use lowercase letters, numbers and hyphens (3–40 characters).");
  return s;
}
const FORMATS = ["Online", "In person", "Hybrid"];
const OPENING_TYPES = ["PhD position", "Postdoc", "Research assistant", "Collaborator", "Other"];
function oneOf(v, name, list, fallback) {
  const s = str(v, name, { max: 60 });
  if (!s) return fallback;
  if (!list.includes(s)) throw bad(`${name} must be one of: ${list.join(", ")}.`);
  return s;
}
/** Must be one of a standard list. Matching ignores case, and the canonical spelling is returned. */
function choice(v, name, list, { required = false } = {}) {
  const s = str(v, name, { max: 120 });
  if (!s) { if (required) throw bad(`${name} is required.`); return ""; }
  const hit = list.find((x) => x.toLowerCase() === s.toLowerCase());
  if (!hit) throw bad(`${name} must be picked from the list.`);
  return hit;
}
function list(v, name, max) {
  if (v == null) return [];
  if (!Array.isArray(v)) throw bad(`${name} must be a list.`);
  if (v.length > max) throw bad(`${name} can have at most ${max} items.`);
  return v;
}

module.exports = { HttpError, bad, str, int, email, url, linkedin, orcid, scholar, ror, date, handle, oneOf, choice, list, FORMATS, OPENING_TYPES };

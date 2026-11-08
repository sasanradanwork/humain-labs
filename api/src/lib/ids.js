"use strict";
const crypto = require("node:crypto");
/**
 * Public identifiers, in the spirit of an ORCID iD: permanent, printable and checkable.
 *   HLG-4K7P-2QA9-3F   a research group
 *   HLR-8M3T-0WX5-7B   a researcher
 * The last character is an ISO 7064 MOD 37,36 check character, so a mistyped ID is
 * rejected rather than pointing at the wrong record.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O or U
const CHECK_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PREFIXES = ["HLG", "HLR"];

function checkChar(body) {
  let p = 36;
  for (const ch of body) {
    const v = CHECK_CHARS.indexOf(ch);
    if (v === -1) throw new Error("bad character");
    p = ((p + v) % 36 || 36) * 2 % 37;
  }
  return CHECK_CHARS[(37 - p) % 36];
}
const format = (prefix, raw) => `${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;

// Strips punctuation and the prefix, so "hlr 8m3t-0wx5 7b" and "HLR-8M3T-0WX5-7B" compare equal.
function normalize(s) {
  const up = String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  for (const p of PREFIXES) if (up.startsWith(p)) return up.slice(p.length);
  return up;
}

function newPublicId(prefix) {
  const bytes = crypto.randomBytes(9);
  let body = "";
  for (let i = 0; i < 9; i++) body += ALPHABET[bytes[i] % 32];
  return format(prefix, body + checkChar(body));
}
function isPublicId(s, prefix) {
  const up = String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (prefix && !up.startsWith(prefix)) return false;
  const raw = normalize(s);
  if (raw.length !== 10) return false;
  try { return checkChar(raw.slice(0, 9)) === raw[9]; } catch { return false; }
}

module.exports = {
  newGroupId: () => newPublicId("HLG"),
  newResearcherId: () => newPublicId("HLR"),
  isGroupId: (s) => isPublicId(s, "HLG"),
  isResearcherId: (s) => isPublicId(s, "HLR"),
  normalizeGroupId: normalize,
  normalizePublicId: normalize,
  formatGroupId: (raw) => format("HLG", normalize(raw)),
  formatResearcherId: (raw) => format("HLR", normalize(raw)),
};

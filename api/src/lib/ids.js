"use strict";
const crypto = require("node:crypto");
/**
 * Public identifier for a research group, in the spirit of an ORCID iD:
 * permanent, printable and checkable, e.g. HLG-4K7P-2QA9-3F.
 * The last character is an ISO 7064 MOD 37,36 check character, so a
 * mistyped ID is rejected rather than pointing at the wrong group.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O or U
const CHECK_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function checkChar(body) {
  let p = 36;
  for (const ch of body) {
    const v = CHECK_CHARS.indexOf(ch);
    if (v === -1) throw new Error("bad character");
    p = ((p + v) % 36 || 36) * 2 % 37;
  }
  return CHECK_CHARS[(37 - p) % 36];
}
const format = (raw) => `HLG-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
const normalizeGroupId = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^HLG/, "");

function newGroupId() {
  const bytes = crypto.randomBytes(9);
  let body = "";
  for (let i = 0; i < 9; i++) body += ALPHABET[bytes[i] % 32];
  return format(body + checkChar(body));
}
function isGroupId(s) {
  const raw = normalizeGroupId(s);
  if (raw.length !== 10) return false;
  try { return checkChar(raw.slice(0, 9)) === raw[9]; } catch { return false; }
}
module.exports = { newGroupId, isGroupId, normalizeGroupId, formatGroupId: (raw) => format(normalizeGroupId(raw)) };

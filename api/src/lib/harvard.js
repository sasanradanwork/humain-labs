"use strict";
/**
 * Turns a list of full author names into a Harvard-style author string:
 *   ["Jane Ann Smith", "Jean-Luc Picard"]  →  "Smith, J.A. and Picard, J.-L."
 * The last word of a name is the surname. For names with a particle (van, de) or
 * a surname made of several words, enter the surname first, separated by a comma:
 *   "van der Berg, Jan"  →  "van der Berg, J."
 */
function splitName(full) {
  const s = String(full || "").trim().replace(/\s+/g, " ");
  if (s.includes(",")) {
    const [surname, ...rest] = s.split(",");
    return { surname: surname.trim(), given: rest.join(",").trim() };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { surname: s, given: "" };
  const surname = parts.pop();
  return { surname, given: parts.join(" ") };
}

const initials = (given) =>
  given
    .split(" ")
    .filter(Boolean)
    .map((part) => part.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + ".").join("-"))
    .join("");

function harvardName(full) {
  const { surname, given } = splitName(full);
  const ini = initials(given);
  return ini ? `${surname}, ${ini}` : surname;
}

function harvardAuthors(names) {
  const out = names.map(harvardName).filter(Boolean);
  if (out.length <= 1) return out.join("");
  return `${out.slice(0, -1).join(", ")} and ${out[out.length - 1]}`;
}

module.exports = { harvardAuthors, harvardName };

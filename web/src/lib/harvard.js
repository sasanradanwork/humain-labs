// Same rules as api/src/lib/harvard.js: the server stores the Harvard string it produces,
// and this copy lets the editor show the result as the author types.
export function splitName(full) {
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

export function harvardName(full) {
  const { surname, given } = splitName(full);
  const ini = initials(given);
  return ini ? `${surname}, ${ini}` : surname;
}

export function harvardAuthors(names) {
  const out = names.map(harvardName).filter(Boolean);
  if (out.length <= 1) return out.join("");
  return `${out.slice(0, -1).join(", ")} and ${out[out.length - 1]}`;
}

// Reads a stored Harvard string back into names, for publications saved before names were entered one by one.
export function namesFromHarvard(str) {
  const s = String(str || "").trim();
  if (!s) return [""];
  const toks = s.replace(/ and /g, ", ").split(", ").map((t) => t.trim()).filter(Boolean);
  if (toks.length % 2) return [s];
  const out = [];
  for (let i = 0; i < toks.length; i += 2) out.push(`${toks[i]}, ${toks[i + 1]}`);
  return out;
}

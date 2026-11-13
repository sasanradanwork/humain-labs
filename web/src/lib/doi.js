// Looking a publication up by its DOI, so a researcher pastes one identifier instead of
// retyping a title, four authors, a journal and a year.
//
// Crossref's public API is the source: free, no key, and it allows cross-origin requests,
// so this works the same in the demo build as it does behind the API. No identifying
// details are sent with the request.

const ENDPOINT = "https://api.crossref.org/works/";

/** A DOI however it was pasted: bare, prefixed, or as a link. Mirrors the server's check. */
export function cleanDoi(raw) {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

export const looksLikeDoi = (raw) => /^10\.\d{4,9}\/\S+$/.test(cleanDoi(raw));

/** "Amara" + "Nwosu" -> "Nwosu, A." — the shape publications are stored in. */
function harvard(a) {
  const family = String(a.family || "").trim();
  const given = String(a.given || "").trim();
  if (!family) return String(a.name || "").trim();
  const initials = given
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + ".")
    .join(" ");
  return initials ? `${family}, ${initials}` : family;
}

/**
 * Fetch one DOI and shape it into a publication row.
 * Throws with something worth reading, because the message goes straight to the form.
 */
export async function lookupDoi(raw) {
  const doi = cleanDoi(raw);
  if (!looksLikeDoi(doi)) throw new Error("That doesn't look like a DOI. They start 10. and look like 10.1038/s41586-020-2649-2.");

  let res;
  try {
    res = await fetch(ENDPOINT + encodeURIComponent(doi), { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new Error("Couldn't reach Crossref just now. Check your connection, or fill the fields in yourself.");
  }
  if (res.status === 404) throw new Error("Crossref has no record of that DOI. Check it, or fill the fields in yourself.");
  if (!res.ok) throw new Error("Crossref couldn't be read just now. Try again in a moment, or fill the fields in yourself.");

  const m = (await res.json()).message || {};
  const authorNames = (m.author || []).map(harvard).filter(Boolean);
  // issued is when it was published; online-first papers carry the print year later.
  const parts = (m.issued && m.issued["date-parts"]) || (m["published-print"] && m["published-print"]["date-parts"]) || [];
  const year = (parts[0] || [])[0] || "";
  const title = (m.title || [])[0] || "";
  if (!title) throw new Error("Crossref has that DOI but no title for it. Fill the fields in yourself.");

  return {
    doi,
    title,
    authorNames: authorNames.length ? authorNames : [""],
    venue: (m["container-title"] || [])[0] || m.publisher || "",
    year: year ? String(year) : "",
    url: m.URL || `https://doi.org/${doi}`,
    // Crossref's own count of works citing this one. Shown as found, not recalculated.
    citations: typeof m["is-referenced-by-count"] === "number" ? m["is-referenced-by-count"] : null,
  };
}

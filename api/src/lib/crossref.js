"use strict";
const { HttpError, bad } = require("./validate");

/**
 * Resolving a DOI to a publication record, server-side.
 *
 * This is the only way a publication reaches a profile. The browser looks a DOI up too,
 * but only to show the researcher what they are adding: whatever it sends is ignored and
 * the record is fetched again here. That matters because publications feed the
 * leaderboard — a client that could name its own authors could award itself the
 * first-author bonus on someone else's paper, or invent the paper entirely.
 */
const ENDPOINT = "https://api.crossref.org/works/";

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
 * Crossref's own type, narrowed to the handful a reader cares to tell apart. Anything
 * unrecognised is "Other" rather than guessed at.
 */
function kindOf(type) {
  const t = String(type || "").toLowerCase();
  if (t === "journal-article") return "Journal article";
  if (t === "proceedings-article" || t === "proceedings") return "Conference paper";
  if (t === "posted-content") return "Preprint";
  if (t.startsWith("book") || t === "monograph" || t === "reference-book") return "Book chapter";
  return "Other";
}

/** Shape one Crossref `message` into the record stored on a profile. */
function fromMessage(doi, m) {
  const title = ((m.title || [])[0] || "").trim();
  if (!title) throw bad(`Crossref has ${doi} but no title for it, so it can't be added.`);
  const authorNames = (m.author || []).map(harvard).filter(Boolean);
  if (!authorNames.length) throw bad(`Crossref lists no authors for ${doi}, so it can't be added.`);
  const parts = (m.issued && m.issued["date-parts"]) || (m["published-print"] && m["published-print"]["date-parts"]) || [];
  const year = Number((parts[0] || [])[0]) || 0;
  if (!year) throw bad(`Crossref gives no publication year for ${doi}, so it can't be scored.`);
  return {
    doi,
    title: title.slice(0, 300),
    authorNames: authorNames.slice(0, 30).map((n) => n.slice(0, 120)),
    authors: authorNames.slice(0, 30).join(", "),
    venue: String((m["container-title"] || [])[0] || m.publisher || "").slice(0, 200),
    kind: kindOf(m.type),
    year,
    url: String(m.URL || `https://doi.org/${doi}`).slice(0, 500),
    citations: typeof m["is-referenced-by-count"] === "number" ? m["is-referenced-by-count"] : null,
    // When the record was taken from Crossref, so a profile can say where its list came from.
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Look one DOI up. Throws an HttpError the person can act on, because the message goes
 * back to the form they are filling in.
 */
async function lookup(doi, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(ENDPOINT + encodeURIComponent(doi), {
      headers: { Accept: "application/json", "User-Agent": "HumAIn Labs (https://humainlabs.ai)" },
    });
  } catch (e) {
    throw new HttpError(502, `Couldn't reach Crossref to check ${doi}. Try again in a moment.`);
  }
  if (res.status === 404) throw bad(`Crossref has no record of ${doi}. Check the DOI.`);
  if (!res.ok) throw new HttpError(502, `Crossref couldn't be read just now (${res.status}). Try again in a moment.`);
  const body = await res.json();
  return fromMessage(doi, (body && body.message) || {});
}

module.exports = { lookup, fromMessage, harvard, ENDPOINT };

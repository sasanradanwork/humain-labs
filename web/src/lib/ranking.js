/**
 * Yearly standing for a researcher.
 *
 * Two things earn points, and both are things that actually happened on or through
 * the platform, so nothing here is invented:
 *   - a publication listed on their profile with that year on it
 *   - a peer endorsement from another verified researcher, recorded against that year
 *
 * Deliberately simple and published in full on the profile page, so a researcher can
 * see exactly where their figure came from. Mirrors api/src/lib/ranking.js — change
 * both together.
 */
export const PUBLICATION_POINTS = 10;
export const FIRST_AUTHOR_BONUS = 5;
export const ENDORSEMENT_POINTS = 4;

// How many years of standing a profile shows at once.
export const YEARS_SHOWN = 5;

export const yearsBack = (thisYear, n = YEARS_SHOWN) => Array.from({ length: n }, (_, i) => thisYear - i);

/**
 * Endorsements a researcher received in one year, as a plain count.
 *
 * A record arrives in one of two shapes and both are read here, so scoring has a single
 * code path: `endorsements` is the stored map of who endorsed when, which only the server
 * and the demo build ever hold; `endorsed` is the count-per-year the API sends out instead,
 * because who endorsed whom stays on the server.
 */
export function endorsementCount(r, year) {
  if (r && r.endorsed && r.endorsed[String(year)] != null) return Number(r.endorsed[String(year)]) || 0;
  const m = (r && r.endorsements && r.endorsements[String(year)]) || null;
  return m ? Object.keys(m).length : 0;
}

/** Did this voter already endorse them that year? Reads either shape, as above. */
export const hasEndorsed = (r, year, voter) => {
  if (r && Array.isArray(r.youEndorsed)) return r.youEndorsed.includes(Number(year));
  return !!(voter && r && r.endorsements && r.endorsements[String(year)] && r.endorsements[String(year)][voter]);
};

/**
 * The surname to compare on, from either shape a name arrives in: a Harvard author
 * string ("Nwosu, A.") or a display name ("Dr. Amara Nwosu"). Two researchers who
 * share a surname would both be credited, which is why this only moves a small bonus.
 */
export function surnameOf(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.includes(",")) return t.split(",")[0].trim().toLowerCase();
  const parts = t.replace(/^(dr|prof|professor|mr|ms|mrs|mx)\.?\s+/i, "").split(/\s+/);
  return (parts[parts.length - 1] || "").toLowerCase();
}

/**
 * What one researcher scored in one year, broken down so the page can show the sum.
 * First authorship is worth a little more, which is why it is counted separately.
 */
export function scoreFor(r, year) {
  const pubs = (r && r.publications ? r.publications : []).filter((p) => Number(p.year) === Number(year));
  const mine = surnameOf((r && r.name) || "");
  const first = pubs.filter((p) => {
    const a = (p.authorNames || [])[0];
    return !!mine && !!a && surnameOf(a) === mine;
  }).length;
  const endorsements = endorsementCount(r, year);
  return {
    year: Number(year),
    publications: pubs.length,
    firstAuthor: first,
    endorsements,
    points: pubs.length * PUBLICATION_POINTS + first * FIRST_AUTHOR_BONUS + endorsements * ENDORSEMENT_POINTS,
  };
}

/**
 * Standing for everyone in one year.
 *
 * Only researchers who scored anything are ranked: someone with no publications and no
 * endorsements that year is unranked rather than bottom, because a zero here means
 * "nothing recorded", not "nothing achieved".
 *
 * The percentile is a percentile rank by the usual midpoint method: everyone who scored
 * less, plus half of everyone tied with you, over the whole ranked field. Counting only
 * those strictly below would put the lowest scorer at a flat zero and hand the top scorer
 * a hundred, neither of which is a fair description of where they stand.
 */
export function standings(researchers, year) {
  const rows = (researchers || []).map((r) => ({ id: r.id, ...scoreFor(r, year) }));
  const ranked = rows.filter((x) => x.points > 0).sort((a, b) => b.points - a.points);
  const total = ranked.length;
  const out = new Map();
  ranked.forEach((x, i) => {
    const below = ranked.filter((y) => y.points < x.points).length;
    const tied = ranked.filter((y) => y.points === x.points).length;
    out.set(x.id, {
      ...x,
      rank: i > 0 && ranked[i - 1].points === x.points ? out.get(ranked[i - 1].id).rank : i + 1,
      ranked: total,
      percentile: total ? Math.round(((below + tied / 2) / total) * 100) : null,
    });
  });
  for (const x of rows) if (!out.has(x.id)) out.set(x.id, { ...x, rank: null, ranked: total, percentile: null });
  return out;
}

/** The last few years of standing for one researcher, newest first. */
export function history(researchers, r, thisYear, n = YEARS_SHOWN) {
  return yearsBack(thisYear, n).map((y) => standings(researchers, y).get(r.id));
}

/** Ranked researchers for one year, best first, for the leaderboard. */
export function leaderboard(researchers, year, limit = 25) {
  const s = standings(researchers, year);
  return (researchers || [])
    .map((r) => ({ researcher: r, ...s.get(r.id) }))
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points || String(a.researcher.name).localeCompare(String(b.researcher.name)))
    .slice(0, limit);
}

"use strict";
/**
 * Trending score for a study, from its applications. Recent applications count
 * for more (the weight halves every 10 days) and newly posted studies get a
 * small boost. The weekly shape is normalised to 0–1 so the page can draw it
 * without revealing actual applicant numbers.
 */
const DAY = 86400000, WEEKS = 8, HALF_LIFE_DAYS = 10, NEW_DAYS = 14;
function trendFor(study, applications, now = Date.now()) {
  const weekly = new Array(WEEKS).fill(0);
  let score = 0;
  for (const a of applications) {
    if (a.studyId !== study.id) continue;
    const age = Math.max(0, (now - Date.parse(a.date + "T12:00:00Z")) / DAY);
    score += Math.pow(0.5, age / HALF_LIFE_DAYS);
    const w = Math.floor(age / 7);
    if (w < WEEKS) weekly[WEEKS - 1 - w] += 1;
  }
  const postedAge = (now - Date.parse(study.postedAt + "T12:00:00Z")) / DAY;
  const isNew = postedAge >= 0 && postedAge <= NEW_DAYS;
  if (isNew) score += 1.5;
  const recent = weekly[WEEKS - 1] + weekly[WEEKS - 2], before = weekly[WEEKS - 3] + weekly[WEEKS - 4];
  const max = Math.max(1, ...weekly);
  return { score: Math.round(score * 100) / 100, weekly: weekly.map((n) => Math.round((n / max) * 100) / 100), isNew, rising: recent > 0 && recent > before };
}
module.exports = { trendFor };

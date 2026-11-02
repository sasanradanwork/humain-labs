"use strict";
// Screens public text (study titles, descriptions, group pages, bios) with Azure AI Content Safety.
// Severity 4 or higher is blocked; severity 2 is posted but marked for review. If screening is switched off
// (no endpoint configured, as in local preview), text is allowed through.
const { HttpError } = require("./validate");

const CATEGORIES = ["Hate", "SelfHarm", "Sexual", "Violence"];
const BLOCK_AT = 4;
const REVIEW_AT = 2;
const LABEL = { Hate: "hateful content", SelfHarm: "self-harm content", Sexual: "sexual content", Violence: "violent content" };

async function analyze(text, { endpoint, key, http = fetch }) {
  const res = await http(`${endpoint.replace(/\/$/, "")}/contentsafety/text:analyze?api-version=2024-09-01`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(text).slice(0, 10000), categories: CATEGORIES, outputType: "FourSeverityLevels" }),
  });
  if (!res.ok) throw new Error(`Content Safety returned ${res.status}`);
  const data = await res.json();
  return data.categoriesAnalysis || [];
}

// fields: { "Study title": "text", ... }. Returns null when clean, or { categories, at } when marked for review.
// Throws HttpError 422 when the text must be removed, and 503 when the check can't be made (we don't publish unchecked text).
async function screenFields(fields, { screen = defaultScreen } = {}) {
  let review = null;
  for (const [label, text] of Object.entries(fields)) {
    if (!String(text || "").trim()) continue;
    const found = await screen(String(text));
    const bad = found.filter((c) => c.severity >= BLOCK_AT).map((c) => LABEL[c.category] || c.category);
    if (bad.length) throw new HttpError(422, `${label} contains ${[...new Set(bad)].join(" and ")}, which we don't allow. Remove it and try again.`);
    const flagged = found.filter((c) => c.severity >= REVIEW_AT).map((c) => c.category);
    if (flagged.length) review = { categories: [...new Set([...(review?.categories || []), ...flagged])], at: new Date().toISOString().slice(0, 10) };
  }
  return review;
}

// Default screener: reads the Azure settings from the environment. Returns a function (text) => [{category, severity}].
function defaultScreen(text) {
  const endpoint = process.env.CONTENT_SAFETY_ENDPOINT;
  const key = process.env.CONTENT_SAFETY_KEY;
  if (!endpoint || !key) return Promise.resolve([]);
  return analyze(text, { endpoint, key }).then((list) => list.map((c) => ({ category: c.category, severity: c.severity })), () => {
    throw new HttpError(503, "We couldn't check this text just now. Try again in a moment.");
  });
}

module.exports = { screenFields, analyze, defaultScreen, CATEGORIES, BLOCK_AT, REVIEW_AT };

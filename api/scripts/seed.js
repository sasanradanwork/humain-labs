"use strict";
/**
 * Loads the starting content into Cosmos DB.
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... node scripts/seed.js
 * Safe to re-run: documents are upserted by id.
 */
const fs = require("node:fs");
const path = require("node:path");
const { cosmosRepo, PARTITION } = require("../src/lib/repo");

(async () => {
  if (!process.env.COSMOS_CONNECTION_STRING && !(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY)) {
    console.error("Set COSMOS_ENDPOINT and COSMOS_KEY (or COSMOS_CONNECTION_STRING) first.");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8"));
  const repo = cosmosRepo();
  for (const name of Object.keys(PARTITION)) {
    for (const doc of data[name] || []) await repo.upsert(name, doc);
    console.log(`${name}: ${(data[name] || []).length} documents`);
  }
  console.log("Done.");
})().catch((e) => { console.error(e.message); process.exit(1); });

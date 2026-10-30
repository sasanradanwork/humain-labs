"use strict";
/**
 * Data access. Every container except "applications" is partitioned on /id;
 * applications are partitioned on /studyId so a study's applicants sit together.
 */
const PARTITION = { researchers: "id", groups: "id", studies: "id", applications: "studyId" };
const QUERYABLE = new Set(["userId", "researcherId", "studyId", "ownerId", "handle", "groupId", "publicId"]);
const strip = (d) => { if (!d) return d; const { _rid, _self, _etag, _attachments, _ts, ...rest } = d; return rest; };

function cosmosRepo() {
  const { CosmosClient } = require("@azure/cosmos");
  const client = process.env.COSMOS_CONNECTION_STRING
    ? new CosmosClient(process.env.COSMOS_CONNECTION_STRING)
    : new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
  const db = client.database(process.env.COSMOS_DATABASE || "humain");
  const c = (name) => db.container(name);
  return {
    async all(name) {
      const { resources } = await c(name).items.query("SELECT * FROM c").fetchAll();
      return resources.map(strip);
    },
    async where(name, field, value) {
      if (!QUERYABLE.has(field)) throw new Error(`Field ${field} is not queryable`);
      const { resources } = await c(name).items
        .query({ query: `SELECT * FROM c WHERE c.${field} = @v`, parameters: [{ name: "@v", value }] })
        .fetchAll();
      return resources.map(strip);
    },
    async get(name, id, pk) {
      try {
        const { resource } = await c(name).item(id, pk ?? id).read();
        return resource ? strip(resource) : null;
      } catch (e) {
        if (e.code === 404) return null;
        throw e;
      }
    },
    async upsert(name, doc) {
      await c(name).items.upsert(doc);
      return doc;
    },
    async remove(name, id, pk) {
      try { await c(name).item(id, pk ?? id).delete(); } catch (e) { if (e.code !== 404) throw e; }
    },
  };
}

/** In-memory repository, used by the tests. */
function memoryRepo(seed = {}) {
  const data = {};
  for (const k of Object.keys(PARTITION)) data[k] = new Map((seed[k] || []).map((d) => [d.id, JSON.parse(JSON.stringify(d))]));
  const clone = (d) => (d ? JSON.parse(JSON.stringify(d)) : null);
  return {
    data,
    async all(name) { return [...data[name].values()].map(clone); },
    async where(name, field, value) { return [...data[name].values()].filter((d) => d[field] === value).map(clone); },
    async get(name, id) { return clone(data[name].get(id)); },
    async upsert(name, doc) { data[name].set(doc.id, clone(doc)); return doc; },
    async remove(name, id) { data[name].delete(id); },
  };
}

module.exports = { cosmosRepo, memoryRepo, PARTITION };

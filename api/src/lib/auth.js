"use strict";
/**
 * Azure Static Web Apps signs users in and passes their identity to the API
 * in the x-ms-client-principal header (base64 JSON). Managed functions are
 * only reachable through the Static Web App, so this header can't be forged
 * by a caller.
 */
function getPrincipal(headers) {
  const raw = typeof headers.get === "function" ? headers.get("x-ms-client-principal") : headers["x-ms-client-principal"];
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (!p || !p.userId) return null;
    return { userId: String(p.userId), provider: p.identityProvider || "", details: p.userDetails || "", roles: p.userRoles || [] };
  } catch {
    return null;
  }
}
module.exports = { getPrincipal };

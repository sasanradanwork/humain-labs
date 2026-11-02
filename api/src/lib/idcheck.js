"use strict";
// Identity checks run through Stripe Identity. Stripe hosts the photo ID and selfie steps; we only receive
// a result, never the ID document itself.
const crypto = require("crypto");

async function startStripeCheck({ key, userId, role, returnUrl, http = fetch }) {
  const form = new URLSearchParams({
    type: "document",
    "options[document][require_matching_selfie]": "true",
    "metadata[userId]": String(userId),
    "metadata[role]": role,
  });
  if (returnUrl) form.set("return_url", returnUrl);
  const res = await http("https://api.stripe.com/v1/identity/verification_sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe returned ${res.status}`);
  return { id: data.id, url: data.url, status: data.status };
}

// Stripe signs each webhook with the endpoint secret: HMAC-SHA256 of "timestamp.body". Rejects anything
// unsigned, altered, or more than five minutes old.
function verifyWebhook(rawBody, header, secret, now = Date.now()) {
  if (!secret || !header) return null;
  const parts = String(header).split(",").map((p) => p.trim());
  const t = (parts.find((p) => p.startsWith("t=")) || "").slice(2);
  const sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > 300) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const ok = sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  return ok ? JSON.parse(rawBody) : null;
}

module.exports = { startStripeCheck, verifyWebhook };

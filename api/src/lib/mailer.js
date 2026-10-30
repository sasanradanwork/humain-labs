"use strict";
/**
 * Sends email through Azure Communication Services. Returns null when the
 * ACS_CONNECTION_STRING / EMAIL_SENDER settings aren't present.
 */
function acsMailer() {
  const conn = process.env.ACS_CONNECTION_STRING, sender = process.env.EMAIL_SENDER;
  if (!conn || !sender) return null;
  const { EmailClient } = require("@azure/communication-email");
  const client = new EmailClient(conn);
  return {
    async send({ to, subject, text }) {
      const poller = await client.beginSend({
        senderAddress: sender,
        recipients: { to: [{ address: to }] },
        content: { subject, plainText: text },
      });
      const result = await poller.pollUntilDone();
      if (result.status !== "Succeeded") throw new Error(`Email send failed: ${result.status}`);
    },
  };
}
module.exports = { acsMailer };

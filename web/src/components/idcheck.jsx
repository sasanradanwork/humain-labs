// Identity check: Stripe hosts the photo ID and selfie steps. We only learn whether the check passed.
import { useState } from "react";
import { AUTH } from "../lib/store.js";
import { useUI } from "../lib/ui.jsx";

export function IdCheckPanel({ returnTo }) {
  const { backend, toast } = useUI();
  const [busy, setBusy] = useState(false);
  const rec = AUTH.researcher || AUTH.participant;
  if (!rec) return null;
  const verified = !!rec.idVerified;
  const pending = !verified && rec.idCheck?.status === "pending";
  const start = async () => {
    setBusy(true);
    try {
      const back = window.location.href.split("#")[0] + returnTo;
      const r = await backend.startIdCheck(back);
      if (r?.verified) toast(r.preview ? "Identity check skipped in preview." : "Identity verified.");
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fsec" style={{ marginTop: 18 }}>
      <h2>Identity check</h2>
      {verified ? (
        <p className="hint">✓ Your identity is verified.</p>
      ) : (
        <>
          <p className="hint">
            We need to confirm you're a real person. You'll show a photo ID and take a selfie. Stripe does the check, so we never see or store your ID. It
            usually takes a few minutes and you only do it once.
          </p>
          {pending && <p className="small soft">Your check is in progress. Come back once it's finished.</p>}
          <button type="button" className="btn btn-solid" onClick={start} disabled={busy}>
            {pending ? "Start a new check" : "Verify my identity"}
          </button>
        </>
      )}
    </div>
  );
}

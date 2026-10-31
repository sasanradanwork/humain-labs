// Participant details: set up once after registering, then used for every application.
import { useState } from "react";
import { ChoiceField } from "../components/fields.jsx";
import { AUTH } from "../lib/store.js";
import { COUNTRY_NAMES } from "../lib/lists.js";
import { Field, Form, SubmitButton, navigate, useUI } from "../lib/ui.jsx";

// Applying is locked until the email on the details has been confirmed with a code.
const emailConfirmed = (p) => !!p && p.emailVerified?.email === p.email;

export function ParticipantProfile({ onDelete }) {
  const { backend, toast } = useUI();
  const [sent, setSent] = useState(null);
  const p = AUTH.participant;
  if (!AUTH.user)
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Your details</h1>
          </div>
        </div>
        <div className="empty">
          <div>Sign in to set up your details.</div>
          <a className="btn btn-blue" href="#/auth?mode=signin&as=participant">
            Sign in
          </a>
        </div>
      </div>
    );
  if (AUTH.researcher)
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Your details</h1>
            <p className="soft">Researcher accounts don't apply to studies, so there are no participant details to set up.</p>
          </div>
        </div>
        <a className="btn" href="#/dashboard">
          Go to your researcher area
        </a>
      </div>
    );
  const fromAccount = AUTH.user.name && !/@/.test(AUTH.user.name) ? AUTH.user.name : "";
  const confirmed = emailConfirmed(p);
  const after = () => {
    const next = sessionStorage.getItem("after-profile");
    sessionStorage.removeItem("after-profile");
    navigate(next || "#/studies");
  };
  return (
    <div className="wrap">
      <div className="editor">
        <h1 style={{ marginTop: 14 }}>{p ? "Your details" : "Set up your details"}</h1>
        <p className="soft lead">
          Set these up once. Every study you apply to uses them, so you won't need to type them in again. Only the researcher running a study you apply
          to sees them.
        </p>
        <Form
          onSubmit={async (d) => {
            const sameEmail = !!p && p.email.toLowerCase() === d.email.trim().toLowerCase();
            await backend.saveParticipant({ name: d.name, email: d.email, age: Number(d.age), country: d.country });
            if (sameEmail && confirmed) {
              toast("Details saved.");
              after();
              return;
            }
            toast(
              !p
                ? "Details saved. Confirm your email below to unlock studies."
                : sameEmail
                  ? "Details saved."
                  : "Details saved. Your email has changed, so confirm the new address below."
            );
          }}
        >
          <div className="fsec">
            <div className="stack">
              <Field label="Full name" required>
                <input name="name" required maxLength="120" defaultValue={p?.name || fromAccount} autoComplete="name" autoFocus />
              </Field>
              <div className="row2">
                <Field label="Email" required>
                  <input name="email" type="email" required defaultValue={p?.email || AUTH.user.email || ""} autoComplete="email" />
                </Field>
                <Field label="Age" required hint={<div className="counter" style={{ textAlign: "left" }}>You need to be 16 or over.</div>}>
                  <input name="age" type="number" min="16" max="120" required defaultValue={p?.age || ""} />
                </Field>
              </div>
              <ChoiceField label="Country" name="country" options={COUNTRY_NAMES} required defaultValue={p?.country} />
            </div>
          </div>
          <div className="actions">
            <SubmitButton className="btn btn-solid">{p ? "Save changes" : "Save my details"}</SubmitButton>
            <a className="btn" href="#/studies">
              Not now
            </a>
          </div>
        </Form>

        {p && !confirmed && (
          <div className="fsec" id="confirm-email" style={{ marginTop: 22 }}>
            <h2>Confirm your email</h2>
            <p className="hint">
              Confirm <strong>{p.email}</strong> to unlock studies. We'll send a 6-digit code to that address.
            </p>
            {!sent ? (
              <Form onSubmit={async () => setSent(await backend.sendParticipantCode())}>
                <SubmitButton className="btn btn-solid">Send me a code</SubmitButton>
              </Form>
            ) : (
              <Form
                onSubmit={async (c) => {
                  await backend.confirmParticipantCode(c.code);
                  setSent(null);
                  toast("Email confirmed. You can now apply to studies.");
                  if (sessionStorage.getItem("after-profile")) after();
                }}
              >
                {sent.devCode && (
                  <div className="demo-hint" style={{ marginTop: 0 }}>
                    Preview mode: no email is sent here, so your code is <strong>{sent.devCode}</strong>.
                  </div>
                )}
                <div className="stack" style={{ marginTop: 12 }}>
                  <Field label="6-digit code" required>
                    <input
                      name="code"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength="6"
                      placeholder="123456"
                      style={{ letterSpacing: ".3em", fontSize: "1.1rem" }}
                      autoFocus
                    />
                  </Field>
                </div>
                <div className="actions" style={{ marginTop: 14 }}>
                  <SubmitButton className="btn btn-solid">Confirm email</SubmitButton>
                  <button type="button" className="btn" onClick={async () => setSent(await backend.sendParticipantCode())}>
                    Send a new code
                  </button>
                </div>
              </Form>
            )}
          </div>
        )}

        {p && confirmed && (
          <p className="small soft" style={{ marginTop: 18 }}>
            ✓ Your email {p.email} is confirmed. You can apply to studies.
          </p>
        )}

        {p && (
          <div className="fsec" style={{ marginTop: 26 }}>
            <h2>Delete your details</h2>
            <p className="hint">
              This removes your participant details and every application you've made. You can set them up again at any time, but you'll need to confirm
              your email again.
            </p>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Delete my details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

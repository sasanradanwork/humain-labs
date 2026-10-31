// Participant details: set up once after registering, then used for every application.
import { ChoiceField } from "../components/fields.jsx";
import { AUTH } from "../lib/store.js";
import { COUNTRY_NAMES } from "../lib/lists.js";
import { Field, Form, SubmitButton, navigate, useUI } from "../lib/ui.jsx";

export function ParticipantProfile() {
  const { backend, toast } = useUI();
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
            await backend.saveParticipant({ name: d.name, email: d.email, age: Number(d.age), country: d.country });
            toast(p ? "Details saved." : "Details saved. You can now apply to studies.");
            const next = sessionStorage.getItem("after-profile");
            sessionStorage.removeItem("after-profile");
            navigate(next || "#/studies");
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
      </div>
    </div>
  );
}

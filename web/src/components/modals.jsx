// The dialogs: applying, posting a study, verification, publication stats and the ROR lookup.
import { useState } from "react";
import { Field, Form, Modal, SubmitButton, navigate, useUI } from "../lib/ui.jsx";
import { AUTH, S, groupsOf, role } from "../lib/store.js";
import { DAY_MS, FORMATS, FREE_MAIL, plural, today, UserError } from "../lib/util.js";
import { COUNTRY_NAMES, FIELDS } from "../lib/lists.js";
import { ChoiceField } from "./fields.jsx";

export function ApplyModal({ study: s, onClose }) {
  const { backend, toast } = useUI();
  const p = AUTH.participant;
  // Details are set up once, so the dialog only asks for them if they're missing.
  if (!p)
    return (
      <Modal onClose={onClose}>
        <h2>Set up your details first</h2>
        <p className="soft" style={{ marginTop: 10 }}>
          Add your name, email, age and country once. Every application uses them, so you won't need to type them in again for each study.
        </p>
        <div className="actions" style={{ marginTop: 18 }}>
          <button
            className="btn btn-solid"
            type="button"
            onClick={() => {
              sessionStorage.setItem("after-profile", location.hash);
              onClose();
              navigate("#/participant");
            }}
          >
            Set up my details
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async (d) => {
          await backend.apply({ studyId: s.id, notes: d.notes || "", consent: true });
          onClose();
          toast(`Application sent to ${s.researcherName}.`);
        }}
      >
        <h2>Apply: {s.title}</h2>
        <p className="small soft">
          Run by {s.researcherName}, {s.institution}
        </p>
        <div className="applying-as">
          <div>
            <span className="small soft">Applying as</span>
            <strong>{p.name}</strong>
            <span className="small soft">
              {p.email} · age {p.age} · {p.country}
            </span>
          </div>
          <a className="small" href="#/participant" onClick={() => onClose()}>
            Change
          </a>
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          <Field label="Anything the researcher should know? (optional)">
            <textarea name="notes" rows="3" maxLength="1000" />
          </Field>
          <label className="check">
            <input type="checkbox" name="consent" required /> I agree to {s.researcherName} contacting me about this study.
          </label>
        </div>
        <p className="note">
          Who can take part: {s.criteria || "open to all"}. Only {s.researcherName} can see your details.
        </p>
        <SubmitButton>Submit application</SubmitButton>
      </Form>
    </Modal>
  );
}

export function StudyModal({ existing, onClose, onSaved }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const s = existing || { field: me.field, country: me.country, format: "Online" };
  const mine = groupsOf(me.id);
  const maxDate = new Date(Date.now() + 365 * DAY_MS).toISOString().slice(0, 10);
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async (d) => {
          const saved = await backend.saveStudy(d, existing?.id);
          onSaved?.(saved);
          onClose();
          toast(existing ? "Study saved." : "Study published.");
        }}
      >
        <h2>{existing ? "Edit study" : "Post a new study"}</h2>
        <p className="small soft">
          Posted as {me.name}, {me.institution}.
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          <Field label="Study title" required>
            <input name="title" required maxLength="160" defaultValue={s.title || ""} autoFocus />
          </Field>
          <div className="row2">
            <ChoiceField label="Field" name="field" options={FIELDS} required defaultValue={s.field} />
            <ChoiceField label="Country" name="country" options={COUNTRY_NAMES} required defaultValue={s.country} />
          </div>
          <Field label="Research group">
            <select name="groupId" defaultValue={s.groupId || ""}>
              <option value="">None</option>
              {mine.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="row2">
            <Field label="Format">
              <select name="format" defaultValue={s.format || "Online"}>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Time needed">
              <input name="duration" maxLength="120" defaultValue={s.duration || ""} placeholder="e.g. 30 min survey" />
            </Field>
          </div>
          <div className="row2">
            <Field label="Reward (optional)">
              <input name="compensation" maxLength="120" defaultValue={s.compensation || ""} placeholder="e.g. £10 voucher" />
            </Field>
            <Field label="Applications close on" required>
              <input name="closesAt" type="date" required min={today()} max={maxDate} defaultValue={s.closesAt || ""} />
            </Field>
          </div>
          <Field label="What's involved" required>
            <textarea name="description" rows="3" required maxLength="2000" defaultValue={s.description || ""} />
          </Field>
          <Field label="Who can take part" required>
            <input name="criteria" required maxLength="400" defaultValue={s.criteria || ""} placeholder="e.g. 18+, living in the UK" />
          </Field>
        </div>
        <SubmitButton style={{ marginTop: 18 }}>{existing ? "Save changes" : "Publish study"}</SubmitButton>
      </Form>
    </Modal>
  );
}

export function VerifyModal({ onClose }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const [sent, setSent] = useState(null);
  if (!me) return null;
  const suggested = FREE_MAIL.has((me.email || "").split("@")[1]) ? "" : me.email;
  return (
    <Modal onClose={onClose}>
      {!sent ? (
        <Form onSubmit={async (d) => setSent(await backend.verifyStart(d.email))}>
          <h2>Verify your institution email</h2>
          <p className="small soft">
            We'll send a 6-digit code to an email address at {me.institution}. Personal addresses like Gmail or Outlook can't be used.
          </p>
          <div className="stack" style={{ marginTop: 16 }}>
            <Field label="Institution email">
              <input name="email" type="email" required defaultValue={suggested} placeholder="you@university.ac.uk" autoFocus />
            </Field>
          </div>
          <SubmitButton style={{ marginTop: 16 }}>Send code</SubmitButton>
        </Form>
      ) : (
        <Form
          onSubmit={async (c) => {
            await backend.verifyConfirm(c.code);
            await backend.refreshMe?.();
            onClose();
            toast("You're verified. The badge now shows on your profile and studies.");
          }}
        >
          <h2>Enter your code</h2>
          <p className="small soft">
            {sent.devCode ? "" : <>We've sent a 6-digit code to <strong>{sent.email}</strong>. It expires in 15 minutes.</>}
          </p>
          {sent.devCode && (
            <div className="demo-hint" style={{ marginTop: 0 }}>
              Preview mode: no email is sent here, so your code is <strong>{sent.devCode}</strong>. On the live site it's emailed to {sent.email}.
            </div>
          )}
          <div className="stack" style={{ marginTop: 16 }}>
            <Field label="Code">
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
          <SubmitButton style={{ marginTop: 16 }}>Verify</SubmitButton>
        </Form>
      )}
    </Modal>
  );
}

export function ScholarModal({ onClose }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  if (!me) return null;
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async (d) => {
          const r = await backend.fetchScholar(d.orcid);
          await backend.refreshMe?.();
          onClose();
          toast(`Found ${plural(r.metrics?.works ?? AUTH.researcher?.metrics?.works ?? 0, "publication", "publications")} on OpenAlex.`);
        }}
      >
        <h2>Publication stats</h2>
        <p className="small soft">
          We look your figures up in <strong>OpenAlex</strong>, the open database of scholarly work, using your ORCID iD. Google Scholar has no public
          data feed and doesn't allow automated access, so your Scholar profile stays as a link.
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          <Field label="ORCID iD">
            <input
              name="orcid"
              required
              maxLength="60"
              pattern="(https?://orcid\.org/)?\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]"
              defaultValue={me.orcid || ""}
              placeholder="0000-0002-1825-0097"
              autoFocus
            />
          </Field>
        </div>
        <p className="note">Don't have one? You can register for an ORCID iD free at orcid.org, then come back.</p>
        <SubmitButton>Fetch my stats</SubmitButton>
      </Form>
    </Modal>
  );
}

export function RorModal({ seed, onPick, onClose }) {
  const { backend } = useUI();
  const [results, setResults] = useState(null);
  return (
    <Modal onClose={onClose}>
      <Form onSubmit={async (d) => setResults(await backend.rorSearch(d.q))}>
        <h2>Find your institution in ROR</h2>
        <p className="small soft">
          The Research Organization Registry is the open registry of research institutions. Picking your institution here attaches its permanent ID to
          your group page.
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          <Field label="Institution name">
            <input name="q" required defaultValue={seed} placeholder="e.g. University of Manchester" autoFocus />
          </Field>
        </div>
        <SubmitButton style={{ marginTop: 14 }}>{results ? "Search again" : "Search ROR"}</SubmitButton>
      </Form>
      <div id="ror-results">
        {results &&
          (results.length ? (
            <div className="ror-list">
              {results.map((x) => (
                <button key={x.ror} type="button" className="ror-hit" onClick={() => onPick(x)}>
                  <span>
                    <strong>{x.name}</strong>
                    <span className="small soft">{[x.city, x.country].filter(Boolean).join(", ")}</span>
                  </span>
                  <code>{x.ror}</code>
                </button>
              ))}
            </div>
          ) : (
            <p className="small soft" style={{ marginTop: 14 }}>
              Nothing in ROR matches that. Try the institution's full official name.
            </p>
          ))}
      </div>
    </Modal>
  );
}

export function ConfirmModal({ title, text, label, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async () => {
          await onConfirm();
          onClose();
        }}
      >
        <h2>{title}</h2>
        <p className="soft small" style={{ margin: "10px 0 18px" }}>
          {text}
        </p>
        <div className="actions">
          <button className="btn btn-danger" type="submit">
            {label}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </Form>
    </Modal>
  );
}

export const isResearcherView = () => role() === "researcher";

// Researchers rate each participant once their study has closed. Other researchers see only the average.
export function RateModal({ app: a, study: st, onClose }) {
  const { backend, toast } = useUI();
  const r = a.rating || null;
  const [stars, setStars] = useState(r?.stars || 0);
  const [attended, setAttended] = useState(r?.attended === true ? "yes" : r?.attended === false ? "no" : "");
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async (d) => {
          if (!stars) throw new UserError("Pick a rating from 1 to 5 stars.");
          await backend.rate(a.id, { stars, attended: attended === "yes" ? true : attended === "no" ? false : null, comment: d.comment || "" });
          onClose();
          toast("Rating saved.");
        }}
      >
        <h2>Rate {a.name}</h2>
        <p className="small soft">
          For “{st.title}”. Other researchers see only the average score and how many ratings it's based on. Your note stays private.
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="f field-stack">
            <span className="req">Rating</span>
            <div className="star-row" role="radiogroup" aria-label="Rating out of five">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className={"star" + (n <= stars ? " on" : "")}
                  onClick={() => setStars(n)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="f field-stack">
            <span>Did they take part?</span>
            <div className="radio-row">
              {[
                ["yes", "Yes"],
                ["no", "No"],
                ["", "Not sure"],
              ].map(([v, label]) => (
                <label key={label} className="check">
                  <input type="radio" name="attended-choice" checked={attended === v} onChange={() => setAttended(v)} /> {label}
                </label>
              ))}
            </div>
          </div>
          <Field label="Private note (optional)">
            <textarea name="comment" rows="3" maxLength="1000" defaultValue={r?.comment || ""} />
          </Field>
        </div>
        <SubmitButton style={{ marginTop: 14 }}>Save rating</SubmitButton>
      </Form>
    </Modal>
  );
}

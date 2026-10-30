// The dialogs: applying, posting a study, verification, publication stats and the ROR lookup.
import { useState } from "react";
import { Field, Form, Modal, SubmitButton, useUI } from "../lib/ui.jsx";
import { AUTH, S, groupsOf, role } from "../lib/store.js";
import { COUNTRIES, DAY_MS, FORMATS, FREE_MAIL, normCountry, plural, today, uniq } from "../lib/util.js";

export const CountryList = () => (
  <datalist id="countries">
    {Object.keys(COUNTRIES).map((c) => (
      <option key={c} value={c} />
    ))}
  </datalist>
);
export const FieldList = () => (
  <datalist id="fields">
    {uniq([...S.studies, ...S.researchers, ...S.groups].map((x) => x.field)).map((f) => (
      <option key={f} value={f} />
    ))}
  </datalist>
);
export const InstList = () => (
  <datalist id="insts">
    {uniq([...S.researchers, ...S.groups].map((x) => x.institution)).map((f) => (
      <option key={f} value={f} />
    ))}
  </datalist>
);

export function ApplyModal({ study: s, onClose }) {
  const { backend, toast } = useUI();
  return (
    <Modal onClose={onClose}>
      <Form
        onSubmit={async (d) => {
          await backend.apply({
            studyId: s.id,
            name: d.name,
            email: d.email,
            age: Number(d.age),
            country: normCountry(d.country),
            notes: d.notes || "",
            consent: true,
          });
          onClose();
          toast(`Application sent to ${s.researcherName}.`);
        }}
      >
        <h2>Apply: {s.title}</h2>
        <p className="small soft">
          Run by {s.researcherName}, {s.institution}
        </p>
        <div className="stack" style={{ marginTop: 16 }}>
          <Field label="Full name">
            <input name="name" required defaultValue={AUTH.researcher?.name || (AUTH.user?.name && !/@/.test(AUTH.user.name) ? AUTH.user.name : "")} autoFocus />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required defaultValue={AUTH.user?.email || ""} />
          </Field>
          <div className="row2">
            <Field label="Age">
              <input name="age" type="number" min="16" max="120" required />
            </Field>
            <Field label="Country">
              <input name="country" list="countries" required />
            </Field>
          </div>
          <Field label="Anything the researcher should know? (optional)">
            <textarea name="notes" rows="3" maxLength="1000" />
          </Field>
          <label className="check">
            <input type="checkbox" name="consent" required /> I agree to {s.researcherName} contacting me about this study.
          </label>
        </div>
        <CountryList />
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
          const saved = await backend.saveStudy({ ...d, country: normCountry(d.country) }, existing?.id);
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
            <Field label="Field" required>
              <input name="field" list="fields" required defaultValue={s.field || ""} />
            </Field>
            <Field label="Country" required>
              <input name="country" list="countries" required defaultValue={s.country || ""} />
            </Field>
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
        <CountryList />
        <FieldList />
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

// Form controls for values that must come from a standard list, so the filters on the
// researchers, groups and studies pages stay consistent.
import { Field } from "../lib/ui.jsx";
import { harvardAuthors } from "../lib/harvard.js";
import { Icon } from "./ui.jsx";

export function ChoiceField({ label, name, options, required = false, defaultValue = "", hint, placeholder = "Choose from the list" }) {
  return (
    <Field label={label} required={required} hint={hint}>
      <select name={name} required={required} defaultValue={defaultValue || ""}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

// The institution is picked from the Research Organization Registry, never typed freehand.
export function InstitutionField({ value, onFind }) {
  return (
    <Field
      label="Institution"
      required
      hint={
        <div className="counter" style={{ textAlign: "left" }}>
          {value.ror
            ? `Linked to the Research Organization Registry (ror.org/${value.ror})`
            : "Pick your institution from the Research Organization Registry, the open list of research institutions."}
        </div>
      }
    >
      <div className="withbtn">
        <input name="institution" required readOnly value={value.name} placeholder="Not chosen yet" />
        <button type="button" className="btn" onClick={onFind}>
          {value.name ? "Change" : "Choose"}
        </button>
      </div>
    </Field>
  );
}

// Each author's full name goes in its own box. Names are turned into Harvard style when saved.
export function AuthorNames({ names, onChange }) {
  const set = (i, v) => onChange(names.map((n, j) => (j === i ? v : n)));
  return (
    <div className="authors">
      {names.map((n, i) => (
        <div className="author-row" key={i}>
          <input
            value={n}
            required={i === 0}
            maxLength="120"
            placeholder="Full name, e.g. Jane Ann Smith"
            aria-label={`Author ${i + 1}, full name`}
            onChange={(e) => set(i, e.target.value)}
          />
          <button
            type="button"
            className="btn icon-btn"
            onClick={() => onChange(names.filter((_, j) => j !== i))}
            disabled={names.length === 1}
            aria-label={`Remove author ${i + 1}`}
          >
            <Icon.x />
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...names, ""])}>
        Add an author
      </button>
      <p className="small soft harvard-preview">
        <span>Saved as: </span>
        {harvardAuthors(names.map((n) => n.trim()).filter(Boolean)) || "…"}
      </p>
      <p className="small soft">A name with a particle (van, de) is easiest entered surname first: van der Berg, Jan.</p>
    </div>
  );
}

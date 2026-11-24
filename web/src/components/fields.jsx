// Form controls for values that must come from a standard list, so the filters on the
// researchers, groups and studies pages stay consistent.
import { useState } from "react";
import { Field } from "../lib/ui.jsx";
import { harvardAuthors } from "../lib/harvard.js";
import { COUNTRY_NAMES } from "../lib/lists.js";
import { Flag, Icon } from "./ui.jsx";

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

/**
 * The country, with its flag beside the list. A native <option> cannot carry an image,
 * so the flag of whatever is chosen is shown next to the control instead — which is also
 * how you can tell at a glance that a country you picked has a flag to draw.
 */
export function CountryField({ name = "country", label = "Country", required = false, defaultValue = "", hint }) {
  const [country, setCountry] = useState(defaultValue || "");
  return (
    <Field label={label} required={required} hint={hint}>
      <div className="withflag">
        <span className="flagbox" aria-hidden="true">
          {country ? <Flag country={country} size={16} /> : null}
        </span>
        <select name={name} required={required} value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Choose from the list</option>
          {COUNTRY_NAMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
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

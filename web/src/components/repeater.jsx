// A list of rows you can add to and remove from, used by the profile editor for
// publications, roles, memberships and the rest. The group editor's hand-rolled
// repeaters use the same .rep markup, so these look and behave the same.
import { Field } from "../lib/ui.jsx";

/**
 * @param rows      the current array
 * @param setRows   replaces the array
 * @param blank     a new empty row
 * @param noun      ["Publication", "No publications added."] — heading for each row, and the empty line
 * @param children  (row, set) => the fields; `set(key, value)` updates that row
 */
export function Repeater({ rows, setRows, blank, noun, children, max = 100 }) {
  const [one, empty] = noun;
  const set = (i) => (k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <>
      <div>
        {rows.length ? (
          rows.map((r, i) => (
            <div className="rep" key={i}>
              <div className="rep-head">
                <span>
                  {one} {i + 1}
                </span>
                <button type="button" className="link small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              {children(r, set(i), i)}
            </div>
          ))
        ) : (
          <p className="rep-empty">{empty}</p>
        )}
      </div>
      {rows.length < max && (
        <button type="button" className="btn" onClick={() => setRows([...rows, { ...blank }])}>
          Add {rows.length ? "another" : /^[aeiou]/i.test(one) ? "an" : "a"} {one.toLowerCase()}
        </button>
      )}
    </>
  );
}

/** The from/to pair every role row carries. Leaving "to" empty means they still hold it. */
export function YearSpan({ row, set, year }) {
  return (
    <div className="row2">
      <Field label="From">
        <input type="number" min="1900" max={year + 1} value={row.from || ""} onChange={(e) => set("from", e.target.value)} />
      </Field>
      <Field label="To" hint={<div className="counter" style={{ textAlign: "left" }}>Leave empty if it's current</div>}>
        <input type="number" min="1900" max={year + 10} value={row.to || ""} onChange={(e) => set("to", e.target.value)} />
      </Field>
    </div>
  );
}

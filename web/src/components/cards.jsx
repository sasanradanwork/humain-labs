// Cards and the search/filter toolbar shared by the three directory pages.
import { Avatar, Cover, DeadlinePill, Icon, LinkedInLink, Radar, ScholarLink, TrendChips, VerifiedBadge, UnverifiedBadge } from "./ui.jsx";
import { AUTH, S, applied, byId, groupsOf, memberResearchers, role, studyGroupName, studyVerified } from "../lib/store.js";
import { fmtDate, plural, trendFor, uniq } from "../lib/util.js";
import { navigate } from "../lib/ui.jsx";
import { useState } from "react";

export const studyTrend = (s) => s.trend || trendFor(s, S.applications);
export const groupHref = (g) => `#/groups/${encodeURIComponent(g.publicId || g.id)}`;
export function lookingFor(g) {
  const k = uniq((g.openings || []).map((o) => o.type));
  if (S.studies.some((s) => s.groupId === g.id)) k.push("Study participants");
  return k;
}

/** The button at the bottom of a study card: apply, your own study, or a note for researchers. */
export function StudyAction({ study, full = true, onApply, solid = false }) {
  const own = AUTH.researcher && study.researcherId === AUTH.researcher.id;
  if (own)
    return (
      <a className={"btn" + (full ? " btn-full" : "")} href={`#/dashboard?study=${study.id}`}>
        Your study: see applicants
      </a>
    );
  if (role() === "researcher") return <span className="small soft">Participants apply from their own accounts.</span>;
  if (applied(study.id))
    return (
      <button className={"btn" + (full ? " btn-full" : "")} disabled>
        You've applied
      </button>
    );
  return (
    <button className={`btn ${solid ? "btn-solid" : "btn-blue"}${full ? " btn-full" : ""}`} onClick={() => onApply(study)}>
      Apply to take part
    </button>
  );
}

// Study timeline: four milestones, each selectable to show its dates.
const TL_STEPS = [
  { label: "Eligibility", from: "eligibilityStart", to: "eligibilityEnd", c: "var(--blue)", tint: "var(--blue-tint)" },
  { label: "Experiment", from: "experimentStart", to: "experimentEnd", c: "var(--t1f)", tint: "var(--t1b)" },
  { label: "Validation", to: "validationEnd", c: "var(--green)", tint: "var(--green-tint)" },
  { label: "End date", to: "endDate", c: "var(--amber)", tint: "var(--amber-tint)" },
];
const fmtTL = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set");

export function StudyTimeline({ study: s }) {
  const [active, setActive] = useState(0);
  if (!TL_STEPS.some((st) => s[st.to])) return <p className="small soft tl-empty">Dates not set yet</p>;
  const st = TL_STEPS[active];
  const range = st.from ? `${fmtTL(s[st.from])} to ${fmtTL(s[st.to])}` : fmtTL(s[st.to]);
  return (
    <div className="tl">
      <ol className="tl-track">
        {TL_STEPS.map((x, i) => (
          <li key={x.label}>
            <button
              type="button"
              className="tl-dot"
              aria-pressed={i === active}
              style={{ "--c": x.c, "--tint": x.tint }}
              onClick={() => setActive(i)}
            >
              <span className="tl-mark" aria-hidden="true">{i + 1}</span>
              <span className="tl-label">{x.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="tl-detail small"><strong>{st.label}:</strong> {range}</p>
    </div>
  );
}

// A participant's progress through a study. Tap a stage to see when it was reached.
export const APP_STAGES = ["Applied", "Eligibility confirmed", "Experiment", "Validation", "Completed"];
export function ApplicationStages({ app: a }) {
  const [picked, setPicked] = useState(null);
  const current = Number.isInteger(a.stage) ? a.stage : 0;
  const out = a.status === "withdrawn";
  const i = picked ?? current;
  let detail;
  if (i === current && out) detail = `${a.withdrawReason === "eligibility" ? "not eligible" : "withdrew"}, on ${fmtDate(a.withdrawnAt)}`;
  else if (i > current) detail = "not reached yet";
  else detail = i === 0 ? fmtDate(a.date) : a.stageDates?.[i] ? fmtDate(a.stageDates[i]) : "reached";
  return (
    <div className="tl" aria-label="Your progress through this study">
      <ol className="tl-track five">
        {APP_STAGES.map((label, j) => {
          const state = j < current ? "done" : j === current ? (out ? "out" : "now") : "todo";
          const c = { done: "var(--green)", now: "var(--blue)", out: "var(--amber)", todo: "var(--ink-soft)" }[state];
          return (
            <li key={label}>
              <button type="button" className="tl-dot" aria-pressed={i === j} style={{ "--c": c }} onClick={() => setPicked(j)}>
                <span className="tl-mark" aria-hidden="true">{state === "done" ? "✓" : state === "out" ? "✕" : j + 1}</span>
                <span className="tl-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="tl-detail small"><strong>{APP_STAGES[i]}:</strong> {detail}</p>
    </div>
  );
}

export function StudyCard({ study: s, onApply }) {
  const v = studyVerified(s);
  const gName = studyGroupName(s);
  const group = s.groupId ? byId("groups", s.groupId) : null;
  return (
    <article className="card">
      <div className="cover">
        <Cover seed={s.id} label={s.field} />
        <span className="chip">{s.field}</span>
      </div>
      <div className="body">
        <h3>{s.title}</h3>
        <div className="small soft">
          {s.researcherName}, {s.institution}
        </div>
        <div className="badges">
          <DeadlinePill study={s} />
          <VerifiedBadge v={v} withDomain={false} />
          <TrendChips t={studyTrend(s)} />
        </div>
        {gName &&
          (role() === "researcher" && group ? (
            <a className="small" href={groupHref(group)}>
              {gName}
            </a>
          ) : (
            <span className="small soft">{gName}</span>
          ))}
        <div className="small soft" style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <Icon.globe /> {s.country}
        </div>
        <dl className="facts">
          {s.format && (
            <>
              <dt>Format</dt>
              <dd>{s.format}</dd>
            </>
          )}
          {s.duration && (
            <>
              <dt>Time</dt>
              <dd>{s.duration}</dd>
            </>
          )}
          {s.compensation && (
            <>
              <dt>Reward</dt>
              <dd>{s.compensation}</dd>
            </>
          )}
        </dl>
        <p className="small grow" style={{ marginTop: 6 }}>
          {s.description}
        </p>
        {s.criteria && <div className="elig">Who can take part: {s.criteria}</div>}
        <StudyTimeline study={s} />
        <div className="foot">
          <StudyAction study={s} onApply={onApply} />
        </div>
      </div>
    </article>
  );
}

export function ResearcherCard({ researcher: r }) {
  const gs = groupsOf(r.id);
  return (
    <article className="card">
      <div className="body">
        {r.metrics && (
          <>
            <div className="radar-mini" tabIndex={0} role="button" aria-label={`Show publication stats for ${r.name}`}>
              <Radar m={r.metrics} size={62} />
            </div>
            {/* The expanded view covers the whole card, so nothing behind it shows through. */}
            <div className="radar-pop">
              <div className="pop-head">
                <div>
                  <h3>{r.name}</h3>
                  <div className="small soft">Publication stats</div>
                </div>
                <Avatar name={r.name} size={34} />
              </div>
              <Radar m={r.metrics} size={150} labels />
              <div className="small soft pop-note">
                From {r.metrics.source || "OpenAlex"}, updated {fmtDate(r.metrics.updatedAt)}. Each axis is scaled against the highest figure among
                researchers here.
              </div>
            </div>
          </>
        )}
        <div className="person">
          <Avatar name={r.name} size={48} />
          <div style={{ minWidth: 0 }}>
            <h3>{r.name}</h3>
            <ContactReveal handle={r.handle} />
          </div>
        </div>
        <div className="badges" style={{ marginTop: 6 }}>
          {r.verified ? <VerifiedBadge v={r.verified} /> : <UnverifiedBadge />}
          {r.idVerified && (
            <span className="badge">
              <Icon.check /> ID checked
            </span>
          )}
        </div>
        {r.position && (
          <div className="small" style={{ marginTop: 8 }}>
            {r.position}
          </div>
        )}
        <div className="small soft" style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Icon.inst />
          <span>
            {r.institution}
            {r.department ? `, ${r.department}` : ""}
          </span>
        </div>
        <div className="small soft" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Icon.globe /> {r.country}
        </div>
        <div>
          <span className="badge">{r.field}</span>
        </div>
        <p className="small grow" style={{ marginTop: 6 }}>
          {r.bio}
        </p>
        {gs.map((g) => (
          <a key={g.id} className="small" href={groupHref(g)}>
            Member of {g.name}
          </a>
        ))}
        <div className="foot">
          <div className="btns">
            <a className="btn btn-blue" href={`mailto:${r.email}?subject=${encodeURIComponent("Collaboration via HumAIn Labs")}`}>
              <Icon.mail /> Contact
            </a>
            <LinkedInLink url={r.linkedin} />
            <ScholarLink url={r.scholar} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function GroupCard({ group: g }) {
  const wants = lookingFor(g);
  const mem = memberResearchers(g);
  const pubs = (g.publications || []).length;
  const go = () => navigate(groupHref(g));
  return (
    <article
      className="card click"
      role="link"
      tabIndex={0}
      aria-label={g.name}
      onClick={(e) => !e.target.closest("a,button") && go()}
      onKeyDown={(e) => e.key === "Enter" && go()}
    >
      <div className="cover">
        <Cover seed={g.id} label={g.field} />
        <span className="chip">{g.field}</span>
      </div>
      <div className="body">
        <h3>{g.name}</h3>
        <div className="small soft">{g.institution}</div>
        <div className="small soft" style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <Icon.globe /> {g.country}
        </div>
        <p className="small grow" style={{ marginTop: 6 }}>
          {g.summary}
        </p>
        <div className="badges" style={{ marginTop: 8 }}>
          {wants.length ? (
            wants.map((w) => (
              <span key={w} className="badge">
                Looking for: {w}
              </span>
            ))
          ) : (
            <span className="small soft">Not recruiting right now</span>
          )}
        </div>
        <div className="foot">
          <div className="avs">
            {mem.slice(0, 4).map((m) => (
              <Avatar key={m.researcherId} name={m.r.name} size={28} />
            ))}
          </div>
          <span className="small soft">
            {plural(g.members ? mem.length : g.memberCount || 0, "member", "members")}, {plural(pubs, "publication", "publications")}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Search box, dropdown filters and the result count shared by the directory pages. */
export function Toolbar({ page, filters, setFilters, defs, hint, toggle, count, total, noun, children }) {
  const isFiltered = Object.entries(filters).some(([k, v]) => k !== "sort" && v);
  const set = (k, v) => setFilters({ ...filters, [k]: v });
  const clear = () => {
    const next = { ...filters };
    Object.keys(next).forEach((k) => {
      if (k !== "sort") next[k] = typeof next[k] === "boolean" ? false : "";
    });
    setFilters(next);
  };
  const [one, many] = noun;
  return (
    <>
      <div className="toolbar" data-page={page}>
        <label className="search">
          <Icon.search />
          <input type="search" value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder={hint} aria-label="Search" data-f="q" />
        </label>
        {defs.map(([key, allLabel, options]) => {
          const v = filters[key];
          const opts = !v || options.includes(v) ? options : [...options, v];
          return (
            <select key={key} data-f={key} aria-label={allLabel} value={v} onChange={(e) => set(key, e.target.value)}>
              <option value="">{allLabel}</option>
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          );
        })}
        {toggle && (
          <label className="toggle">
            <input type="checkbox" data-f={toggle.key} checked={!!filters[toggle.key]} onChange={(e) => set(toggle.key, e.target.checked)} /> {toggle.label}
          </label>
        )}
      </div>
      <div className="meta-row">
        <span id="count">{isFiltered ? `Showing ${count} of ${plural(total, one, many)}` : plural(total, one, many)}</span>
        {isFiltered && (
          <button className="link small" onClick={clear}>
            Clear search and filters
          </button>
        )}
      </div>
      <div id="results">
        {count ? (
          <div className="grid">{children}</div>
        ) : isFiltered ? (
          <div className="empty">
            <div>Nothing matches that search. Try fewer filters or a different word.</div>
            <button className="btn" onClick={clear}>
              Clear search and filters
            </button>
          </div>
        ) : (
          <div className="empty">
            <div>No {many} listed yet.</div>
          </div>
        )}
      </div>
    </>
  );
}

// The handle stays blurred until the person chooses to show it. Email addresses are not shown on the directory.
export function ContactReveal({ handle }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="handle contact-line">
      <span className={"blur-text" + (shown ? " shown" : "")}>@{handle}</span>
      <button type="button" className="link small" onClick={() => setShown((x) => !x)} aria-pressed={shown}>
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

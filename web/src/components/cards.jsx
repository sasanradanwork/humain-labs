// Cards and the search/filter toolbar shared by the three directory pages.
import { Avatar, Cover, DeadlinePill, Icon, LinkedInLink, Radar, ScholarLink, TrendChips, VerifiedBadge, UnverifiedBadge } from "./ui.jsx";
import { AUTH, S, applied, byId, groupsOf, memberResearchers, role, studyGroupName, studyVerified } from "../lib/store.js";
import { fmtDate, plural, trendFor, uniq } from "../lib/util.js";
import { navigate } from "../lib/ui.jsx";

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
            <div className="handle">@{r.handle}</div>
          </div>
        </div>
        <div className="badges" style={{ marginTop: 6 }}>
          {r.verified ? <VerifiedBadge v={r.verified} /> : <UnverifiedBadge />}
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
            {plural(mem.length, "member", "members")}, {plural(pubs, "publication", "publications")}
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

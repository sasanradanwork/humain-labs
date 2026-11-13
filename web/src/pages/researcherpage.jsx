// A researcher's own page: who they are, what they've published, the roles they hold,
// and where their work stood each year. Reached by opening a card in the directory.
import { useState } from "react";
import { Avatar, Flag, Icon, LinkedInLink, Radar, ScholarLink, VerifiedBadge, UnverifiedBadge } from "../components/ui.jsx";
import { HlgBadge } from "../components/hlg.jsx";
import { InterestTree } from "../components/interests.jsx";
import { PointsBars, PubBars, ordinal } from "../components/charts.jsx";
import { AUTH, S, byId, groupsOf, role } from "../lib/store.js";
import { DISCIPLINES } from "../lib/lists.js";
import { fmtDate, gidKey, plural } from "../lib/util.js";
import { navigate, useUI } from "../lib/ui.jsx";
import { groupHref, researcherHref } from "../components/cards.jsx";
import { ResearcherGate } from "./public.jsx";
import {
  ENDORSEMENT_POINTS, FIRST_AUTHOR_BONUS, PUBLICATION_POINTS, YEARS_SHOWN,
  hasEndorsed, history, leaderboard, standings,
} from "../lib/ranking.js";

/** Find a researcher from whatever the address bar holds: an HLR identifier, an id or a @handle. */
export function researcherByRef(ref) {
  if (!ref) return null;
  const key = gidKey(ref);
  const handle = String(ref).replace(/^@/, "").toLowerCase();
  return (
    S.researchers.find((r) => r.publicId && gidKey(r.publicId) === key) ||
    S.researchers.find((r) => r.id === ref) ||
    S.researchers.find((r) => (r.handle || "").toLowerCase() === handle) ||
    null
  );
}

export { researcherHref };

const thisYear = () => new Date().getFullYear();
// A role with no end year is one they still hold.
const span = (x) => (x.from ? `${x.from}–${x.to || "present"}` : x.to ? `until ${x.to}` : "");

/* ================= standing ================= */

/**
 * This year's standing, the years behind it, and the button to endorse.
 *
 * The whole formula is printed here rather than hidden: a ranking nobody can check is
 * not worth having, and a researcher should be able to see exactly what moved theirs.
 */
function Standing({ r }) {
  const { backend, toast } = useUI();
  const [busy, setBusy] = useState(false);
  const year = thisYear();
  const rows = history(S.researchers, r, year, YEARS_SHOWN);
  const now = rows[0];
  const me = AUTH.researcher;
  const own = me && me.id === r.id;
  const mine = hasEndorsed(r, year, me?.id);

  const endorse = async () => {
    if (!backend?.endorse) return;
    setBusy(true);
    try {
      await backend.endorse(r.id, year);
      toast(mine ? "Endorsement withdrawn." : `You've endorsed ${r.name} for ${year}.`);
    } catch (e) {
      toast(e.message || "That didn't work. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sec">
      <h2>Standing</h2>
      <div className="standing">
        <div className="pct">
          {/* The headline is one number, so it is a stat rather than a chart. */}
          <b>{now.percentile == null ? "—" : ordinal(now.percentile)}</b>
          <span>
            {now.percentile == null
              ? `Unranked for ${year}`
              : `percentile for ${year}, among ${plural(now.ranked, "ranked researcher", "ranked researchers")}`}
          </span>
          {now.rank && (
            <span className="small soft">
              {ordinal(now.rank)} by points · {now.points} points this year
            </span>
          )}
        </div>
        <PointsBars rows={rows} />
      </div>

      <div className="table-wrap">
      <table className="rank-table">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Publications</th>
            <th scope="col">Endorsements</th>
            <th scope="col">Points</th>
            <th scope="col">Percentile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.year}>
              <th scope="row">{x.year}</th>
              <td>
                {x.publications}
                {x.firstAuthor ? <span className="soft small"> ({x.firstAuthor} first author)</span> : null}
              </td>
              <td>{x.endorsements}</td>
              <td>{x.points}</td>
              <td>{x.percentile == null ? <span className="soft">Unranked</span> : ordinal(x.percentile)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="small soft rank-note">
        Points are {PUBLICATION_POINTS} for each publication listed with that year on it, {FIRST_AUTHOR_BONUS} more when you are
        first author, and {ENDORSEMENT_POINTS} for each peer endorsement. The percentile is a percentile rank: everyone who scored
        less, plus half of anyone tied with you. A year with nothing recorded is unranked rather than last.
      </p>

      <div className="endorse-row">
        {own ? (
          <span className="small soft">Colleagues can endorse your work here. You can't endorse yourself.</span>
        ) : !me ? (
          <span className="small soft">Researchers signed in to HumAIn Labs can endorse this work.</span>
        ) : !me.verified ? (
          <span className="small soft">Verify your institution email to endorse another researcher's work.</span>
        ) : (
          <>
            <button className={"btn" + (mine ? "" : " btn-blue")} onClick={endorse} disabled={busy}>
              <Icon.check /> {mine ? `Endorsed for ${year} — withdraw` : `Endorse this work for ${year}`}
            </button>
            <span className="small soft">One endorsement per researcher per year.</span>
          </>
        )}
      </div>
    </section>
  );
}

/* ================= the page ================= */

export function ResearcherPage({ id, own: ownPage = false }) {
  const r = researcherByRef(id);
  const { toast } = useUI();
  // A profile set to public is readable by anyone, exactly as a public group is. A
  // private one needs a researcher account, so visitors see the gate instead.
  if (r && r.visibility !== "public" && role() !== "researcher" && AUTH.researcher?.id !== r.id)
    return <ResearcherGate title="Researchers" />;
  if (!r && role() !== "researcher") return <ResearcherGate title="Researchers" />;
  if (!r)
    return (
      <div className="wrap">
        <a className="back" href="#/researchers">
          ← Back to researchers
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>That researcher isn't listed any more.</div>
          <a className="btn" href="#/researchers">
            See all researchers
          </a>
        </div>
      </div>
    );

  const own = AUTH.researcher?.id === r.id;
  const pubs = [...(r.publications || [])].sort((a, b) => b.year - a.year);
  // Every year between the first and last publication gets a slot, including the empty
  // ones: evenly spaced bars that skipped a year would read as consecutive.
  const counts = pubs.reduce((m, p) => ({ ...m, [p.year]: (m[p.year] || 0) + 1 }), {});
  const pubYears = pubs.map((p) => Number(p.year));
  const last = pubYears.length ? Math.max(...pubYears) : 0;
  const first = pubYears.length ? Math.max(Math.min(...pubYears), last - 9) : 0;
  const years = pubYears.length
    ? Array.from({ length: last - first + 1 }, (_, i) => ({ year: first + i, count: counts[first + i] || 0 }))
    : [];
  const gs = groupsOf(r.id);
  const supervising = (r.supervising || []).map((s) => ({ ...s, r: byId("researchers", s.researcherId) })).filter((s) => s.r);
  // The other side of the same relationship: who lists this person as their student.
  const supervisors = S.researchers.filter((o) => (o.supervising || []).some((s) => s.researcherId === r.id));
  const highlights = [...(r.highlights || [])].sort((a, b) => (b.year || 0) - (a.year || 0));
  const academic = r.academicRoles || [];
  const research = r.researchRoles || [];
  const memberships = r.memberships || [];
  // Stored as paths; a profile written before that holds plain strings, which read as
  // one-step paths.
  const interests = (r.interests || []).map((x) => (Array.isArray(x) ? x : [x])).filter((x) => x.length);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(r.publicId);
      toast("Researcher ID copied.");
    } catch (e) {
      toast(r.publicId);
    }
  };

  return (
    <div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {ownPage ? (
          <a className="back" href="#/dashboard">
            ← Researcher area
          </a>
        ) : (
          <a className="back" href="#/researchers">
            ← Back to researchers
          </a>
        )}
        {own && (
          <div className="btns">
            <span className={"vis-pill" + (r.visibility === "public" ? " on" : "")} title={r.visibility === "public" ? "Anyone can see this page." : "Only signed-in researchers can see this page."}>
              <Icon.globe /> {r.visibility === "public" ? "Public profile" : "Private profile"}
            </span>
            <a className="btn btn-blue" href="#/profile/edit">
              <Icon.pencil /> Edit your profile
            </a>
          </div>
        )}
      </div>

      <div className="rhero">
        <Avatar name={r.name} size={84} />
        <div style={{ minWidth: 0 }}>
          <h1>{r.name}</h1>
          <div className="small soft">
            {r.position}
            {r.position && r.institution ? " · " : ""}
            {r.institution}
            {r.department ? `, ${r.department}` : ""}
          </div>
          <div className="small soft" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
            <Flag country={r.country} /> {r.country}
          </div>
          <div className="badges" style={{ marginTop: 10 }}>
            {r.discipline && <span className="badge badge-disc">{r.discipline}</span>}
            <span className="badge">{r.field}</span>
            {r.verified ? <VerifiedBadge v={r.verified} /> : <UnverifiedBadge />}
            {r.idVerified && (
              <span className="badge badge-pill" title="Identity checked">
                <Icon.check /> ID checked
              </span>
            )}
          </div>
        </div>
        <div className="rhero-act">
          <a className="btn btn-blue" href={`mailto:${r.email}?subject=${encodeURIComponent("Collaboration via HumAIn Labs")}`}>
            <Icon.mail /> Contact
          </a>
          <LinkedInLink url={r.linkedin} />
          <ScholarLink url={r.scholar} />
        </div>
      </div>

      <div className="idbar">
        {r.publicId && (
          <span className="idchip" title="This researcher's permanent HumAIn Labs identifier. Quote it on papers, adverts and applications.">
            <HlgBadge size={16} />
            <span className="idlabel">Researcher ID</span>
            <code>{r.publicId}</code>
            <button className="link small" onClick={copyId}>
              Copy
            </button>
          </span>
        )}
        <span className="idchip">
          <span className="idlabel">Handle</span>
          <code>@{r.handle}</code>
        </span>
      </div>

      <div className="metrics">
        <div>
          <b>{pubs.length}</b>
          <span>Publications listed</span>
        </div>
        <div>
          {r.metrics ? (
            <>
              <b title={`From ${r.metrics.source || "OpenAlex"}`}>{(r.metrics.citations || 0).toLocaleString()}</b>
              <span>Citations</span>
            </>
          ) : (
            <>
              <b className="muted" title="Citations come from OpenAlex, which needs a linked ORCID.">
                —
              </b>
              <span>Citations</span>
            </>
          )}
        </div>
        <div>
          {r.metrics ? (
            <>
              <b>{r.metrics.hIndex}</b>
              <span>h-index</span>
            </>
          ) : (
            <>
              <b className="muted">—</b>
              <span>h-index</span>
            </>
          )}
        </div>
        <div>
          <b>{gs.length}</b>
          <span>Research groups</span>
        </div>
        <div>
          <b>{supervising.length}</b>
          <span>Supervising</span>
        </div>
      </div>

      <div className="two">
        <div>
          <section className="sec">
            <h2>About</h2>
            <p style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{r.bio}</p>
            {interests.length > 0 && (
              <>
                <h3 className="sub">Research interests</h3>
                <InterestTree interests={interests} root={r.discipline} />
              </>
            )}
          </section>

          {highlights.length > 0 && (
            <section className="sec">
              <h2>Highlights</h2>
              <ul className="hl-list">
                {highlights.map((h, i) => (
                  <li key={i}>
                    <Icon.star />
                    <div>
                      <strong>{h.title}</strong>
                      {h.year ? <span className="small soft"> · {h.year}</span> : null}
                      {h.detail && <div className="small soft">{h.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Standing r={r} />

          <section className="sec">
            <h2>Publications</h2>
            {!pubs.length && <p className="soft small">No publications listed yet.</p>}
            {pubs.length > 0 && (
              <>
                <PubBars years={years} />
                <ol className="pub-list">
                  {pubs.map((p, i) => (
                    <li key={i}>
                      <div className="pub-year">{p.year}</div>
                      <div>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener">
                            {p.title}
                          </a>
                        ) : (
                          <strong>{p.title}</strong>
                        )}
                        <div className="small soft">{p.authors}</div>
                        <div className="small soft">{p.venue}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        </div>

        <aside>
          {r.metrics && (
            <section className="sec">
              <h2>Publication stats</h2>
              <Radar m={r.metrics} size={168} labels />
              <p className="small soft" style={{ marginTop: 8 }}>
                From {r.metrics.source || "OpenAlex"}, updated {fmtDate(r.metrics.updatedAt)}. Each axis is scaled against the
                highest figure among researchers here.
              </p>
            </section>
          )}

          {academic.length > 0 && (
            <section className="sec">
              <h2>Academic roles</h2>
              <ul className="role-list">
                {academic.map((a, i) => (
                  <li key={i}>
                    <strong>{a.title}</strong>
                    {a.org && <div className="small soft">{a.org}</div>}
                    <div className="small soft">{span(a)}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {research.length > 0 && (
            <section className="sec">
              <h2>Research roles</h2>
              <ul className="role-list">
                {research.map((a, i) => (
                  <li key={i}>
                    <strong>{a.title}</strong>
                    {a.org && <div className="small soft">{a.org}</div>}
                    <div className="small soft">{span(a)}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(supervising.length > 0 || supervisors.length > 0) && (
            <section className="sec">
              <h2>Supervision</h2>
              {supervising.length > 0 && (
                <>
                  <h3 className="sub">Supervising</h3>
                  <ul className="role-list">
                    {supervising.map((s) => (
                      <li key={s.researcherId}>
                        <a href={researcherHref(s.r)}>{s.r.name}</a>
                        <div className="small soft">{s.role}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {supervisors.length > 0 && (
                <>
                  <h3 className="sub">Supervised by</h3>
                  <ul className="role-list">
                    {supervisors.map((o) => (
                      <li key={o.id}>
                        <a href={researcherHref(o)}>{o.name}</a>
                        <div className="small soft">{(o.supervising.find((s) => s.researcherId === r.id) || {}).role}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {memberships.length > 0 && (
            <section className="sec">
              <h2>Professional memberships</h2>
              <ul className="role-list">
                {memberships.map((m, i) => (
                  <li key={i}>
                    <strong>{m.body}</strong>
                    <div className="small soft">
                      {[m.grade, m.since ? `since ${m.since}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {gs.length > 0 && (
            <section className="sec">
              <h2>Research groups</h2>
              <ul className="role-list">
                {gs.map((g) => (
                  <li key={g.id}>
                    <a href={groupHref(g)}>{g.name}</a>
                    <div className="small soft">{g.institution}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ================= leaderboard ================= */

/** Who scored highest in a given year. Opens from the Researchers page. */
export function Leaderboard() {
  if (role() !== "researcher") return <ResearcherGate title="Leaderboard" />;
  const now = thisYear();
  const [year, setYear] = useState(now);
  const [disc, setDisc] = useState("");
  // Ranking within a discipline means ranking against that discipline only, so the
  // percentile is read against the people filtered in, not against everyone.
  const field = disc ? S.researchers.filter((r) => r.discipline === disc) : S.researchers;
  const rows = leaderboard(field, year, 25);
  const mine = AUTH.researcher ? standings(field, year).get(AUTH.researcher.id) : null;

  return (
    <div className="wrap">
      <a className="back" href="#/researchers">
        ← Back to researchers
      </a>
      <div className="intro" style={{ marginTop: 12 }}>
        <div>
          <h1>Leaderboard</h1>
          <p className="soft">
            Researchers ranked by what they published and the endorsements their peers gave them, one year at a time. Points are{" "}
            {PUBLICATION_POINTS} a publication, {FIRST_AUTHOR_BONUS} more as first author, and {ENDORSEMENT_POINTS} an endorsement.
            {disc ? ` Ranked within ${disc} only.` : ""}
          </p>
        </div>
        <div className="lb-filters">
          <label className="lb-year">
            <span className="small soft">Discipline</span>
            <select value={disc} onChange={(e) => setDisc(e.target.value)}>
              <option value="">All disciplines</option>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="lb-year">
            <span className="small soft">Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: YEARS_SHOWN }, (_, i) => now - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {mine && mine.points > 0 && (
        <div className="lb-you small">
          You are {ordinal(mine.rank)} for {year} on {mine.points} points — the {ordinal(mine.percentile)} percentile.
        </div>
      )}

      {!rows.length ? (
        <div className="empty">
          <div>Nothing recorded for {year}{disc ? ` in ${disc}` : ""} yet.</div>
        </div>
      ) : (
        <div className="table-wrap">
        <table className="rank-table lb">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Researcher</th>
              <th scope="col">Publications</th>
              <th scope="col">Endorsements</th>
              <th scope="col">Points</th>
              <th scope="col">Percentile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr
                key={x.researcher.id}
                className={AUTH.researcher?.id === x.researcher.id ? "me" : ""}
                onClick={() => navigate(researcherHref(x.researcher))}
              >
                <th scope="row">{x.rank}</th>
                <td>
                  <a href={researcherHref(x.researcher)} onClick={(e) => e.stopPropagation()}>
                    {x.researcher.name}
                  </a>
                  <div className="small soft">
                    {x.researcher.discipline ? `${x.researcher.discipline} · ` : ""}
                    {x.researcher.institution}
                  </div>
                </td>
                <td>
                  {x.publications}
                  {x.firstAuthor ? <span className="soft small"> ({x.firstAuthor} first)</span> : null}
                </td>
                <td>{x.endorsements}</td>
                <td>
                  <b>{x.points}</b>
                </td>
                <td>{ordinal(x.percentile)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

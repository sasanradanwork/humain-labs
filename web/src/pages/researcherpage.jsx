// A researcher's own page: who they are, what they've published, the roles they hold,
// and where their work stood each year. Reached by opening a card in the directory.
import { useMemo, useState } from "react";
import { Avatar, Flag, Icon, LinkedInLink, Radar, ScholarLink } from "../components/ui.jsx";
import { HlgBadge } from "../components/hlg.jsx";
import { CardPattern } from "../components/guilloche.jsx";
import { InterestGraph } from "../components/interests.jsx";
import { PointsBars, PubBars, ordinal } from "../components/charts.jsx";
import { AUTH, S, byId, groupsOf, role } from "../lib/store.js";
import { DISCIPLINES } from "../lib/lists.js";
import { fmtDate, gidKey, isOpen, plural } from "../lib/util.js";
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

  // Nothing recorded in any of the years shown: a chart of five empty columns and a
  // table of zeroes says less than one sentence does, and takes a screen to say it.
  const blank = rows.every((x) => x.points === 0);
  if (blank)
    return (
      <section className="pcard">
        <h2>Standing</h2>
        <p className="soft">
          {own
            ? "Nothing recorded yet. Add your publications and your standing appears here, one year at a time."
            : `Nothing recorded for ${r.name.split(" ").slice(-1)[0]} in the last ${YEARS_SHOWN} years.`}
        </p>
        {!own && me && me.verified && !mine && (
          <div className="endorse-row">
            <button className="btn btn-blue" onClick={endorse} disabled={busy}>
              <Icon.check /> Endorse this work for {year}
            </button>
          </div>
        )}
        {own && (
          <div className="endorse-row">
            <a className="btn" href="#/profile/edit">
              <Icon.pencil /> Add publications
            </a>
          </div>
        )}
      </section>
    );

  return (
    <section className="pcard">
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

/**
 * Public or private, as an eye you can click.
 *
 * Public means the page is listed to visitors who are not signed in, the way a public
 * group is. One word says which it is; the rest is in the tooltip, so the rail stays
 * quiet.
 */
function VisibilityEye({ r }) {
  const { backend, toast } = useUI();
  const [busy, setBusy] = useState(false);
  const on = r.visibility === "public";

  const flip = async () => {
    setBusy(true);
    try {
      // Everything else goes back unchanged: only visibility moves. The base is the
      // full own record, not the shaped copy the directory holds.
      await backend.saveProfile({ ...AUTH.researcher, visibility: on ? "private" : "public" }, AUTH.researcher.id);
      toast(on ? "Your profile is private — only signed-in researchers can see it." : "Your profile is public.");
    } catch (e) {
      toast(e.message || "That didn't save. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={"pa pa-eye" + (on ? " is-on" : "")}
      onClick={flip}
      disabled={busy}
      aria-label={on ? "Profile is public. Make it private." : "Profile is private. Make it public."}
      title={on ? "Anyone can see this page. Click to make it private." : "Only signed-in researchers can see this page. Click to make it public."}
    >
      {on ? <Icon.eye /> : <Icon.eyeOff />}
      <span className="pa-word">{on ? "Public" : "Private"}</span>
    </button>
  );
}

/**
 * How far a researcher has got through checking: L1 is an institution email confirmed by
 * code, L2 adds a documentary identity check. One marking replaces the two separate
 * pills, so the record carries a level the way a document carries a class.
 */
const LEVELS = ["Not verified", "Email verified", "Identity verified"];

function VerificationLevel({ r }) {
  const level = r.idVerified ? 2 : r.verified ? 1 : 0;
  const at = r.verified && r.verified.domain ? ` (@${r.verified.domain})` : "";
  const why = [
    "No institution email has been verified yet.",
    `Institution email verified${at}. No identity check has been completed.`,
    `Institution email verified${at}, and identity documents checked.`,
  ][level];
  return (
    <span className={`vlvl vlvl-${level}`} title={why}>
      <b aria-hidden="true">L{level}</b>
      <span>
        <span className="sr-only">Verification level {level}: </span>
        {LEVELS[level]}
      </span>
    </span>
  );
}

/**
 * The bio, set as a short piece of writing rather than a block of form data: the opening
 * is shown and the rest unfolds, so a long bio doesn't set the height of everything
 * beside it. The cut falls on a word boundary, and never mid-sentence by more than a
 * word, so the preview reads as a sentence rather than a truncation.
 */
const ABOUT_PREVIEW = 200; // characters shown before "Read more"

function About({ bio }) {
  const [open, setOpen] = useState(false);
  const text = String(bio || "").trim();
  const long = text.length > ABOUT_PREVIEW + 40; // not worth a toggle for a few more words
  const cut = long ? text.slice(0, text.lastIndexOf(" ", ABOUT_PREVIEW) + 1 || ABOUT_PREVIEW).trimEnd() : text;

  return (
    <section className="pcard about">
      <h2>About</h2>
      <p className="about-text">
        {long && !open ? `${cut}…` : text}
      </p>
      {long && (
        <button type="button" className="about-more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Read less" : "Read more"}
          <Icon.chev />
        </button>
      )}
    </section>
  );
}


/**
 * The studies this researcher has run: the ones still open, then the ones that have
 * closed. A closed study stays readable — the applicants, the money and the timeline
 * are the record of what happened, and they do not stop mattering on the closing date.
 */
function MyStudies() {
  const me = AUTH.researcher;
  const mine = S.studies.filter((s) => s.researcherId === me?.id);
  const open = mine.filter(isOpen).sort((a, b) => String(a.closesAt || "9999").localeCompare(String(b.closesAt || "9999")));
  const past = mine.filter((s) => !isOpen(s)).sort((a, b) => String(b.closesAt || "").localeCompare(String(a.closesAt || "")));
  const [showPast, setShowPast] = useState(false);

  const Row = ({ s, closed }) => (
    <li className={closed ? "is-closed" : ""}>
      <span className="own-dot" aria-hidden="true" />
      <div className="own-main">
        <a href={`#/studies/${encodeURIComponent(s.id)}`}>{s.title}</a>
        <div className="own-meta">
          <span>{s.field}</span>
          <span>{s.format}</span>
          {s.closesAt && <span>{`${closed ? "closed" : "closes"} ${fmtDate(s.closesAt)}`}</span>}
          {typeof s.places === "number" && <span>{plural(s.places, "place", "places")}</span>}
        </div>
      </div>
      <a className="own-go" href={`#/studies/${encodeURIComponent(s.id)}`} aria-label={`${closed ? "View" : "Manage"} ${s.title}`}>
        {closed ? "View" : "Manage"}
      </a>
    </li>
  );

  return (
    <section className="pcard own-card">
      <div className="sec-head">
        <h2>
          Your studies {mine.length > 0 && <span className="own-n">{mine.length}</span>}
        </h2>
        <a className="own-add" href="#/studies">
          <Icon.lab /> Post a study
        </a>
      </div>

      {open.length > 0 ? (
        <ul className="own-list study-list">
          {open.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </ul>
      ) : (
        <p className="own-empty">
          {mine.length ? "Nothing open at the moment." : "You haven't posted a study yet. Studies are posted and managed on the Studies page."}
        </p>
      )}

      {past.length > 0 && (
        <>
          <button type="button" className="sec-toggle past-toggle" aria-expanded={showPast} onClick={() => setShowPast(!showPast)}>
            <span>
              <Icon.clock /> {plural(past.length, "past study", "past studies")}
            </span>
            <span className={"chev" + (showPast ? " up" : "")} aria-hidden="true">
              ▾
            </span>
          </button>
          {showPast && (
            <ul className="own-list study-list past">
              {past.map((s) => (
                <Row key={s.id} s={s} closed />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** The groups you lead or belong to, with the actions that go with them. */
function MyGroups() {
  const me = AUTH.researcher;
  const gs = groupsOf(me?.id);
  return (
    <section className="pcard own-card">
      <div className="sec-head">
        <h2>
          Your research groups {gs.length > 0 && <span className="own-n">{gs.length}</span>}
        </h2>
        <a className="own-add" href="#/groups/new">
          <Icon.people /> Create a group
        </a>
      </div>
      {gs.length ? (
        <ul className="own-list">
          {gs.map((g) => {
            const myRole = g.members?.find((m) => m.researcherId === me.id)?.role || "Member";
            const lead = /lead/i.test(myRole);
            return (
              <li key={g.id} className={lead ? "" : "is-closed"}>
                <span className="own-dot" aria-hidden="true" />
                <div className="own-main">
                  <a href={groupHref(g)}>{g.name}</a>
                  <div className="own-meta">
                    <span>{myRole}</span>
                    <span>{plural((g.members || []).length, "member", "members")}</span>
                    {g.institution && <span>{g.institution}</span>}
                  </div>
                </div>
                <a className="own-go" href={groupHref(g)} aria-label={`View ${g.name}`}>
                  View
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="own-empty">
          You're not in any groups yet. Create one, or ask a group lead to add you with @{me?.handle}.
        </p>
      )}
    </section>
  );
}

/* ================= the page ================= */

export function ResearcherPage({ id, own: ownPage = false, onVerify, onScholar }) {
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
  const theirStudies = S.studies.filter((s) => s.researcherId === r.id);
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
      <div className={"ppt-row" + (own ? "" : " solo")}>
        {/* The identity, laid out like the data page of a passport: a ruled header, the
            portrait, labelled fields, then the document number along the bottom. */}
        <section className="ppt" aria-label={`${r.name}, researcher record`}>
          <CardPattern className="ppt-pattern" />

          {/* A div, not a <header>: the site's own header palette is scoped to that tag. */}
          <div className="ppt-head">
            <span className="ppt-doc">
              <HlgBadge size={13} />
              <span className="ppt-org">HumAIn Labs ·</span> Researcher record
            </span>
            {own && (
              <div className="ppt-acts">
                <VisibilityEye r={r} />
                <a className="pa" href="#/profile/edit" title="Edit profile" aria-label="Edit profile">
                  <Icon.pencil />
                </a>
              </div>
            )}
          </div>

          <div className="ppt-top">
            <div className="ppt-photo">
              <Avatar name={r.name} size={96} />
              <span className="ppt-caption">{r.discipline || "Researcher"}</span>
            </div>
            <div className="ppt-fields">
              <h1>{r.name}</h1>
              <dl>
                <div>
                  <dt>
                    <Icon.post /> Position
                  </dt>
                  <dd>{r.position || "\u2014"}</dd>
                </div>
                <div>
                  <dt>
                    <Icon.inst /> Institution
                  </dt>
                  <dd>
                    {r.institution}
                    {r.department ? `, ${r.department}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Icon.globe /> Country
                  </dt>
                  <dd className="ppt-country">
                    <Flag country={r.country} /> {r.country}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Icon.book /> Specialised field
                  </dt>
                  <dd>{r.field}</dd>
                </div>
              </dl>
              <div className="ppt-stamps">
                <VerificationLevel r={r} />
                {own && !r.verified && (
                  <button type="button" className="link small" onClick={onVerify}>
                    Verify your institution email
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* What the record amounts to, in one line: what they run and when they joined. */}
          <div className="ppt-facts">
            <span>
              <Icon.people /> {plural(gs.length, "research group", "research groups")}
            </span>
            <span>
              <Icon.lab /> {plural(theirStudies.length, "study", "studies")}
            </span>
            {r.createdAt && (
              <span>
                <Icon.clock /> Registered {fmtDate(r.createdAt)}
              </span>
            )}
          </div>

          <div className="ppt-foot">
            <div className="ppt-id">
              <code>{r.publicId || "\u2014"}</code>
              <span className="ppt-handle">@{r.handle}</span>
              {r.publicId && (
                <button className="link small" onClick={copyId}>
                  Copy
                </button>
              )}
            </div>
            <div className="ppt-social">
              {r.linkedin && (
                <a href={r.linkedin} target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn">
                  <Icon.linkedin />
                </a>
              )}
              {r.scholar && (
                <a href={r.scholar} target="_blank" rel="noopener" title="Google Scholar" aria-label="Google Scholar">
                  <Icon.scholar />
                </a>
              )}
              {!own && r.email && (
                <a
                  href={`mailto:${r.email}?subject=${encodeURIComponent("Collaboration via HumAIn Labs")}`}
                  title={`Email ${r.name}`}
                  aria-label={`Email ${r.name}`}
                >
                  <Icon.mail />
                </a>
              )}
              {!r.linkedin && !r.scholar && !(!own && r.email) && <span className="small soft">No links added</span>}
            </div>
          </div>
        </section>

        {/* What you run, beside the record rather than under it. */}
        {own && (
          <div className="own-band">
            <MyStudies />
            <MyGroups />
          </div>
        )}
      </div>

      {/* ---- what they work on: the words on the left, the map of it on the right ---- */}
      <div className={"pduo" + (interests.length ? "" : " one")}>
        <About bio={r.bio} />

        {interests.length > 0 && (
          <section className="pcard">
            <h2>Research interests</h2>
            <InterestGraph interests={interests} root={r.discipline} />
          </section>
        )}
      </div>

      <Standing r={r} />

      {/* ---- the published record ---- */}
      <section className="pcard">
        <div className="sec-head">
          <h2>Publications</h2>
          {own && (
            <a className="link small" href="#/profile/edit">
              Add by DOI →
            </a>
          )}
        </div>
        {!pubs.length ? (
          <p className="soft small">No publications listed yet.</p>
        ) : (
          <div className="pcard-split">
            <div>
              <PubBars years={years} />
              <ol className="pub-list">
                {pubs.map((p, i) => (
                  <li key={p.doi || i}>
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
                      <div className="small soft">
                        {p.venue}
                        {typeof p.citations === "number" ? ` · ${plural(p.citations, "citation", "citations")}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="pcard-side">
              {r.metrics ? (
                <>
                  <h3 className="sub" style={{ marginTop: 0 }}>Publication stats</h3>
                  <Radar m={r.metrics} size={168} labels />
                  <p className="small soft" style={{ marginTop: 8 }}>
                    From {r.metrics.source || "OpenAlex"}, updated {fmtDate(r.metrics.updatedAt)}. Each axis is scaled against the
                    highest figure among researchers here.
                  </p>
                  {own && (
                    <button className="btn" onClick={onScholar}>
                      Refresh stats
                    </button>
                  )}
                </>
              ) : own ? (
                <>
                  <h3 className="sub" style={{ marginTop: 0 }}>Publication stats</h3>
                  <p className="small soft">Link your ORCID and OpenAlex fills in citations, h-index and i10.</p>
                  <button className="btn" onClick={onScholar}>
                    Add via ORCID
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* ---- roles and memberships, in one place rather than four ---- */}
      {(academic.length > 0 || research.length > 0 || memberships.length > 0 || highlights.length > 0) && (
        <section className="pcard">
          <h2>Experience</h2>
          <div className="pcols">
            {academic.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Academic roles</h3>
                <ul className="role-list">
                  {academic.map((a, i) => (
                    <li key={i}>
                      <strong>{a.title}</strong>
                      {a.org && <div className="small soft">{a.org}</div>}
                      <div className="small soft">{span(a)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {research.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Research roles</h3>
                <ul className="role-list">
                  {research.map((a, i) => (
                    <li key={i}>
                      <strong>{a.title}</strong>
                      {a.org && <div className="small soft">{a.org}</div>}
                      <div className="small soft">{span(a)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {memberships.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Memberships</h3>
                <ul className="role-list">
                  {memberships.map((m, i) => (
                    <li key={i}>
                      <strong>{m.body}</strong>
                      <div className="small soft">{[m.grade, m.since ? `since ${m.since}` : ""].filter(Boolean).join(" · ")}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {highlights.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Highlights</h3>
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
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- the people around them ---- */}
      {(supervising.length > 0 || supervisors.length > 0 || (!own && gs.length > 0)) && (
        <section className="pcard">
          <h2>People and groups</h2>
          <div className="pcols">
            {supervising.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Supervising</h3>
                <ul className="role-list">
                  {supervising.map((s) => (
                    <li key={s.researcherId}>
                      <a href={researcherHref(s.r)}>{s.r.name}</a>
                      <div className="small soft">{s.role}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {supervisors.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Supervised by</h3>
                <ul className="role-list">
                  {supervisors.map((o) => (
                    <li key={o.id}>
                      <a href={researcherHref(o)}>{o.name}</a>
                      <div className="small soft">{(o.supervising.find((s) => s.researcherId === r.id) || {}).role}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!own && gs.length > 0 && (
              <div>
                <h3 className="sub" style={{ marginTop: 0 }}>Research groups</h3>
                <ul className="role-list">
                  {gs.map((g) => (
                    <li key={g.id}>
                      <a href={groupHref(g)}>{g.name}</a>
                      <div className="small soft">{g.institution}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ================= leaderboard ================= */

/** "2026-10" -> "October". Used for the line saying when the board was last marked. */
const fmtMonth = (ym) => {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return "last month";
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

/** How far someone has moved since the monthly baseline. */
function Move({ m }) {
  if (!m) return null;
  if (m.kind === "same") return <span className="mv mv-same" title="No change since last month">–</span>;
  if (m.kind === "new")
    return (
      <span className="mv mv-new" title="New to the board this month">
        NEW
      </span>
    );
  const up = m.kind === "up";
  return (
    <span className={"mv " + (up ? "mv-up" : "mv-down")} title={`${up ? "Up" : "Down"} ${m.by} since last month`}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1 L9 8 L1 8 Z" : "M5 9 L1 2 L9 2 Z"} fill="currentColor" />
      </svg>
      {m.by}
    </span>
  );
}

/** Who scored highest in a given year. Opens from the Researchers page. */
export function Leaderboard() {
  const now = thisYear();
  const [year, setYear] = useState(now);
  const [disc, setDisc] = useState("");
  // Anyone can read the leaderboard, and it ranks every verified researcher whether or
  // not their profile is listed publicly — a ranking that quietly left people out would
  // flatter whoever happened to be listed. A visitor is served `ranked`, which carries
  // each private researcher's totals and nothing else; their row is not a link, because
  // there is no page for a visitor to open.
  const guest = role() !== "researcher";
  const everyone = guest && S.ranked.length ? S.ranked : S.researchers;
  // Ranking within a discipline means ranking against that discipline only, so the
  // percentile is read against the people filtered in, not against everyone.
  const field = disc ? everyone.filter((r) => r.discipline === disc) : everyone;
  const rows = leaderboard(field, year, 25);
  const mine = AUTH.researcher ? standings(field, year).get(AUTH.researcher.id) : null;

  // Movement since the monthly baseline. Last month's points are ranked over the same
  // people who are on screen now, so the arrows stay right when a discipline is chosen.
  // Only the current year has a baseline; earlier years are settled and show none.
  const base = year === now ? S.baseline : null;
  const lastRank = useMemo(() => {
    if (!base) return null;
    const scored = field
      .filter((r) => (base.points[r.id] || 0) > 0)
      .map((r) => ({ id: r.id, points: base.points[r.id] || 0 }))
      .sort((a, b) => b.points - a.points);
    const out = new Map();
    scored.forEach((x, i) => {
      const tie = scored.findIndex((y) => y.points === x.points);
      out.set(x.id, tie + 1);
    });
    return out;
  }, [base, field, year]);
  const moveOf = (id, rank) => {
    if (!lastRank) return null;
    const was = lastRank.get(id);
    // Someone with no points last month is new to the board, not "up".
    if (!was) return { kind: "new" };
    const d = was - rank;
    return d === 0 ? { kind: "same" } : { kind: d > 0 ? "up" : "down", by: Math.abs(d) };
  };
  // A signed-in researcher can open any profile; a visitor can open only the public ones.
  const canOpen = (r) => !guest || r.visibility === "public";

  return (
    <div className="wrap">
      <a className="back" href="#/researchers">
        ← Back to researchers
      </a>
      <div className="intro" style={{ marginTop: 12 }}>
        <div>
          <h1>Leaderboard</h1>
          <p className="soft">
            Every verified researcher, ranked on the year's work.
            {disc ? ` Showing ${disc} only.` : ""}
            {guest ? " Private profiles are listed without a link." : ""}
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

      <div className="score-key">
        <div className="sk-items">
          <span className="sk">
            <b>+{PUBLICATION_POINTS}</b> each publication
          </span>
          <span className="sk">
            <b>+{FIRST_AUTHOR_BONUS}</b> if you're first author
          </span>
          <span className="sk">
            <b>+{ENDORSEMENT_POINTS}</b> each peer endorsement
          </span>
        </div>
        <p className="small soft sk-note">
          Publications count in the year they were published; endorsements in the year they were given.{" "}
          {base
            ? `Arrows show movement since ${fmtMonth(base.since)}, when the board was last marked.`
            : "Movement arrows appear once there's a previous month to compare with."}
        </p>
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
                className={(AUTH.researcher?.id === x.researcher.id ? "me" : "") + (canOpen(x.researcher) ? "" : " no-link")}
                onClick={() => canOpen(x.researcher) && navigate(researcherHref(x.researcher))}
              >
                <th scope="row">
                  <span className="lb-rank">
                    {x.rank}
                    <Move m={moveOf(x.researcher.id, x.rank)} />
                  </span>
                </th>
                <td>
                  <span className="lb-who">
                    <Flag country={x.researcher.country} size={14} />
                    {canOpen(x.researcher) ? (
                      <a href={researcherHref(x.researcher)} onClick={(e) => e.stopPropagation()}>
                        {x.researcher.name}
                      </a>
                    ) : (
                      <span className="priv-name" title="This researcher keeps their profile private.">
                        {x.researcher.name}
                        <Icon.lock />
                      </span>
                    )}
                  </span>
                  <div className="small soft lb-where">{x.researcher.institution}</div>
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

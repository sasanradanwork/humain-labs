// The researcher side: directory, group pages, the group editor and the researcher area.
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Icon, LinkedInLink, Radar, ScholarLink, Cover, DeadlinePill, VerifiedBadge, UnverifiedBadge, sortByName } from "../components/ui.jsx";
import { GroupCard, ResearcherCard, Toolbar, groupHref, lookingFor } from "../components/cards.jsx";
import { AUTH, S, appCount, byId, canEditGroup, groupStudies, groupsOf, memberResearchers, role } from "../lib/store.js";
import { fmtDate, gidKey, isOpen, makeHandle, matches, normCountry, OPENING_TYPES, plural, ROLE_SUGGESTIONS, sortName, uniq } from "../lib/util.js";
import { Field, Form, SubmitButton, navigate, replaceRoute, useUI } from "../lib/ui.jsx";
import { AuthorNames, ChoiceField, InstitutionField } from "../components/fields.jsx";
import { HlgBadge } from "../components/hlg.jsx";
import { COUNTRY_NAMES, FIELDS, POSITIONS } from "../lib/lists.js";
import { namesFromHarvard } from "../lib/harvard.js";
import { ResearcherGate, isVisible } from "./public.jsx";

export function groupByRef(ref) {
  if (!ref) return null;
  const key = gidKey(ref);
  return S.groups.find((g) => g.publicId && gidKey(g.publicId) === key) || S.groups.find((g) => g.id === ref) || null;
}

/* ================= researcher directory ================= */
export function Researchers({ filters, setFilters }) {
  if (role() !== "researcher") return <ResearcherGate title="Researchers" />;
  const f = filters;
  const list = S.researchers
    .filter(
      (r) =>
        matches(f.q, [r.name, "@" + r.handle, r.position, r.institution, r.department, r.field, r.country, r.bio]) &&
        (!f.field || r.field === f.field) &&
        (!f.country || r.country === f.country) &&
        (!f.institution || r.institution === f.institution) &&
        (!f.verified || r.verified)
    )
    .sort(sortByName);
  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>Researchers</h1>
          <p className="soft">Researchers across universities and countries. Reach out if you'd like to collaborate.</p>
        </div>
        <a className="btn btn-blue" href="#/profile">
          Edit your profile
        </a>
      </div>
      <Toolbar
        page="researchers"
        filters={filters}
        setFilters={setFilters}
        hint="Search by name, @handle or topic"
        noun={["researcher", "researchers"]}
        count={list.length}
        total={S.researchers.length}
        toggle={{ key: "verified", label: "Verified only" }}
        defs={[
          ["field", "All fields", uniq(S.researchers.map((r) => r.field))],
          ["institution", "All institutions", uniq(S.researchers.map((r) => r.institution))],
          ["country", "All countries", uniq(S.researchers.map((r) => r.country))],
        ]}
      >
        {list.map((r) => (
          <ResearcherCard key={r.id} researcher={r} />
        ))}
      </Toolbar>
    </div>
  );
}

/* ================= group directory ================= */
export function Groups({ filters, setFilters }) {
  if (role() !== "researcher") return <ResearcherGate title="Research groups" />;
  const f = filters;
  const list = S.groups
    .filter((g) => {
      const w = lookingFor(g);
      return (
        matches(f.q, [
          g.name,
          g.institution,
          g.field,
          g.country,
          g.summary,
          (g.focus || []).join(" "),
          memberResearchers(g).map((m) => m.r.name + " @" + m.r.handle).join(" "),
          g.publicId || "",
          g.ror || "",
        ]) &&
        (!f.field || g.field === f.field) &&
        (!f.country || g.country === f.country) &&
        (!f.looking || w.includes(f.looking)) &&
        (!f.open || w.length > 0)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>Research groups</h1>
          <p className="soft">Labs and research groups. Open one to see who's in it, what they've published, and whether they're looking for people.</p>
        </div>
        <a className="btn btn-blue" href="#/groups/new">
          Create a research group
        </a>
      </div>
      <Toolbar
        page="groups"
        filters={filters}
        setFilters={setFilters}
        hint="Search groups or members"
        noun={["group", "groups"]}
        count={list.length}
        total={S.groups.length}
        toggle={{ key: "open", label: "Only groups recruiting" }}
        defs={[
          ["field", "All fields", uniq(S.groups.map((g) => g.field))],
          ["country", "All countries", uniq(S.groups.map((g) => g.country))],
          ["looking", "Looking for anyone", uniq(S.groups.flatMap((g) => lookingFor(g)))],
        ]}
      >
        {list.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </Toolbar>
    </div>
  );
}

/* ================= a group's page ================= */
export function GroupPage({ route, onApply }) {
  const { toast } = useUI();
  const g = groupByRef(route.id);
  // Arrived by internal id or a differently punctuated ID? Swap in the canonical address.
  useEffect(() => {
    if (!g) return;
    const want = groupHref(g);
    if (location.hash !== want) history.replaceState(null, "", want);
  }, [g, route.id]);

  if (!g)
    return (
      <div className="wrap">
        <a className="back" href="#/groups">
          ← Back to research groups
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>This group isn't listed any more.</div>
          <a className="btn" href="#/groups">
            See all research groups
          </a>
        </div>
      </div>
    );

  const gs = groupStudies(g);
  const recruited = gs.reduce((n, s) => n + appCount(s.id), 0);
  const pubs = [...(g.publications || [])].sort((a, b) => b.year - a.year);
  const openings = g.openings || [];
  const mem = memberResearchers(g);
  const withStats = mem.filter((m) => m.r.metrics);
  const citations = withStats.reduce((n, m) => n + (m.r.metrics.citations || 0), 0);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(g.publicId);
      toast("Group ID copied.");
    } catch (e) {
      toast(g.publicId);
    }
  };

  return (
    <div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <a className="back" href="#/groups">
          ← Back to research groups
        </a>
        {canEditGroup(g) && (
          <a className="btn btn-blue" href={`${groupHref(g)}/edit`}>
            Edit group page
          </a>
        )}
      </div>
      <div className="ghero" style={{ marginTop: 14 }}>
        <Cover seed={g.id + "-hero"} label={g.field} />
        <div className="shade" />
        <div className="t">
          <span className="chip">{g.field}</span>
          <h1>{g.name}</h1>
          <div className="small" style={{ opacity: 0.88, marginTop: 4 }}>
            {g.institution}, {g.country}
            {g.founded ? `. Founded ${g.founded}` : ""}
          </div>
        </div>
      </div>
      <div className="idbar">
        {g.publicId && (
          <span className="idchip" title="This group's permanent HumAIn Labs identifier. Quote it on papers, adverts and applications.">
            <HlgBadge size={16} />
            <span className="idlabel">Group ID</span>
            <code>{g.publicId}</code>
            <button className="link small" onClick={copyId}>
              Copy
            </button>
          </span>
        )}
        {g.ror && (
          <a
            className="idchip"
            href={`https://ror.org/${g.ror}`}
            target="_blank"
            rel="noopener"
            title="The institution's entry in the Research Organization Registry"
          >
            <span className="idlabel">ROR</span>
            <code>{g.ror}</code>
            {g.rorName && <span className="small soft">{g.rorName}</span>}
          </a>
        )}
      </div>
      <div className="metrics">
        <div>
          <b>{mem.length}</b>
          <span>Members</span>
        </div>
        <div>
          <b>{pubs.length}</b>
          <span>Publications</span>
        </div>
        <div>
          {withStats.length ? (
            <>
              <b title={`Summed from the OpenAlex figures of ${plural(withStats.length, "member", "members")} who have linked their ORCID`}>
                {citations.toLocaleString()}
              </b>
              <span>Citations{withStats.length < mem.length ? `, from ${withStats.length} of ${mem.length}` : ""}</span>
            </>
          ) : (
            <>
              <b className="muted" title="Citations are summed from members' OpenAlex figures. No member has linked an ORCID yet.">
                —
              </b>
              <span>Citations</span>
            </>
          )}
        </div>
        <div>
          <b>{gs.length}</b>
          <span>Active studies</span>
        </div>
        <div>
          <b>{recruited}</b>
          <span>Participants recruited</span>
        </div>
      </div>
      <div className="two">
        <div>
          <section className="sec">
            <h2>About the group</h2>
            <p style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{g.about || g.summary}</p>
            {(g.focus || []).length > 0 && (
              <div className="badges" style={{ marginTop: 14 }}>
                {g.focus.map((f) => (
                  <span className="badge" key={f}>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </section>
          <section className="sec">
            <h2>Looking for</h2>
            {!openings.length && !gs.length && (
              <div className="opening">
                <span className="soft small">This group isn't recruiting right now. You can still get in touch about collaborating.</span>
              </div>
            )}
            {openings.map((o) => (
              <div className="opening job" key={o.title}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="k">{o.type}</div>
                  <h3>{o.title}</h3>
                  {o.detail && (
                    <p className="small soft" style={{ marginTop: 4 }}>
                      {o.detail}
                    </p>
                  )}
                  {o.deadline && (
                    <p className="small soft" style={{ marginTop: 6 }}>
                      Apply by {fmtDate(o.deadline)}
                    </p>
                  )}
                </div>
                <a className="btn btn-blue" style={{ background: "var(--card)" }} href={`mailto:${g.email}?subject=${encodeURIComponent(`${o.type}: ${o.title}`)}`}>
                  Enquire
                </a>
              </div>
            ))}
            {gs.map((s) => (
              <div className="opening" key={s.id}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="k">Study participants</div>
                  <h3>{s.title}</h3>
                  <p className="small soft" style={{ marginTop: 4 }}>
                    {s.description}
                  </p>
                  {s.criteria && (
                    <p className="elig" style={{ marginTop: 6 }}>
                      Who can take part: {s.criteria}
                    </p>
                  )}
                </div>
                {S.myApps.some((a) => a.studyId === s.id) ? (
                  <button className="btn" disabled>
                    You've applied
                  </button>
                ) : role() === "researcher" ? (
                  <span className="small soft">Participants apply from their own accounts.</span>
                ) : (
                  <button className="btn btn-blue" onClick={() => onApply(s)}>
                    Apply to take part
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="sec">
            <h2>
              <Icon.book /> Publications
            </h2>
            {pubs.length ? (
              <ol className="pubs">
                {pubs.map((p) => (
                  <li key={p.title}>
                    <span className="y">{p.year}</span>
                    <div>
                      <div className="ti">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener">
                            {p.title}
                          </a>
                        ) : (
                          p.title
                        )}
                      </div>
                      <div className="small soft" style={{ marginTop: 3 }}>
                        {String(p.authors || "").replace(/\.\s*$/, "")}. <em>{p.venue}</em>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="soft small">No publications listed yet.</p>
            )}
          </section>
        </div>
        <aside>
          <section className="sec">
            <h2>Who's in the group</h2>
            <div className="members">
              {mem.map((m) => (
                <div className="person" key={m.researcherId}>
                  <Avatar name={m.r.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: ".92rem" }}>{m.r.name}</div>
                    <div className="small" style={{ color: /lead/i.test(m.role) ? "var(--blue)" : "var(--ink-soft)" }}>
                      {m.role}
                    </div>
                    <div className="handle">@{m.r.handle}</div>
                    {m.r.verified && (
                      <div style={{ marginTop: 4 }}>
                        <VerifiedBadge v={m.r.verified} withDomain={false} />
                      </div>
                    )}
                  </div>
                  <span className="mlinks">
                    <LinkedInLink url={m.r.linkedin} className="link li-link" />
                    <ScholarLink url={m.r.scholar} className="link li-link" />
                  </span>
                </div>
              ))}
            </div>
            {g.grants ? (
              <p className="small soft" style={{ marginTop: 10 }}>
                {plural(Number(g.grants), "active grant", "active grants")}
              </p>
            ) : null}
          </section>
          <a className="btn btn-solid btn-full" href={`mailto:${g.email}?subject=${encodeURIComponent("Getting in touch via HumAIn Labs")}`}>
            <Icon.mail /> Contact the group
          </a>
          <p className="small soft" style={{ marginTop: 8, textAlign: "center" }}>
            {g.email}
            {g.website && (
              <>
                <br />
                <a href={g.website} target="_blank" rel="noopener">
                  Group website
                </a>
              </>
            )}
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ================= researcher area ================= */
function SignInPrompt({ title, text }) {
  return (
    <>
      <div className="intro">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="setup">
        <h2>Sign in first</h2>
        <p className="soft">{text}</p>
        <div className="actions">
          <a className="btn btn-solid" href="#/auth?mode=signin&as=researcher">
            Researcher sign in
          </a>
          <a className="btn" href="#/auth?mode=register&as=researcher">
            Register as a researcher
          </a>
        </div>
      </div>
    </>
  );
}
const SetupPrompt = () => (
  <div className="setup">
    <h2>Set up your researcher profile</h2>
    <p className="soft">
      Your profile puts you in the researcher directory, lets other researchers add you to their groups with @, and lets you create groups and post
      studies.
    </p>
    <a className="btn btn-solid" href="#/profile">
      Set up profile
    </a>
  </div>
);

export function Dashboard({ route, onNewStudy, onEditStudy, onDeleteStudy, onVerify, onScholar, onRate }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const myStudies = useMemo(
    () => (me ? S.studies.filter((s) => s.researcherId === me.id).sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt))) : []),
    [me, S.studies]
  );
  const wanted = route.q.get("study");
  const [picked, setPicked] = useState(wanted || "");
  // A link to another study while this page is open should switch the table too.
  useEffect(() => {
    if (wanted) setPicked(wanted);
  }, [wanted]);
  const dashStudy = myStudies.some((s) => s.id === picked) ? picked : myStudies[0]?.id || "";
  const [apps, setApps] = useState(null);
  const [appsError, setAppsError] = useState("");
  const applicantsRef = useRef(null);

  useEffect(() => {
    if (wanted) replaceRoute("#/dashboard");
  }, [wanted]);

  useEffect(() => {
    let live = true;
    setApps(null);
    setAppsError("");
    if (!dashStudy) return;
    backend
      .applicants(dashStudy)
      .then((a) => live && setApps(a))
      .catch((e) => live && setAppsError(e.message));
    return () => {
      live = false;
    };
  }, [dashStudy, backend, S.applications.length, S.appsVersion]);

  if (!AUTH.user)
    return (
      <div className="wrap">
        <SignInPrompt title="Researcher area" text="Researchers sign in here to set up a profile, create research groups and post studies." />
      </div>
    );
  if (!me)
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Researcher area</h1>
            <p className="soft">Signed in as {AUTH.user.name}.</p>
          </div>
        </div>
        <SetupPrompt />
      </div>
    );

  const myGroups = groupsOf(me.id);
  const dashStudyObj = byId("studies", dashStudy);
  // Participants can be rated once the study has closed.
  const dashClosed = !!dashStudyObj && !isOpen(dashStudyObj);
  async function exportCSV() {
    const s = byId("studies", dashStudy);
    if (!s) return;
    let list;
    try {
      list = await backend.applicants(s.id);
    } catch (e) {
      return toast(e.message);
    }
    const rows = [["Name", "Email", "Age", "Country", "Notes", "Applied", "Status"], ...list.map((a) => [a.name, a.email, a.age, a.country, a.notes, a.date, a.status || "active"])];
    const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const filename = `${s.title.replace(/[^\w]+/g, "-").toLowerCase()}-applicants.csv`;
    if (backend.kind === "claude") {
      let dl = null;
      try {
        dl = await window.claude.use("downloads");
      } catch (e) {}
      if (dl) {
        try {
          await dl.save({ filename, data: csv });
        } catch (e) {
          if (e?.code !== "declined") toast("The file couldn't be saved here.");
        }
        return;
      }
    }
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>Researcher area</h1>
        </div>
      </div>
      {!me.verified && (
        <div className="setup" style={{ marginBottom: 28 }}>
          <h2>Verify your institution email to post studies</h2>
          <p className="soft">
            Only verified researchers can post studies, and participants only see studies from verified researchers. It takes a minute: we send a code
            to your institution address.
          </p>
          <button className="btn btn-solid" onClick={onVerify}>
            Verify now
          </button>
        </div>
      )}
      <div className="profile-card">
        <Avatar name={me.name} size={64} />
        <div className="grow">
          <h2>{me.name}</h2>
          <div className="handle">@{me.handle}</div>
          <div className="badges" style={{ marginTop: 6 }}>
            {me.verified ? <VerifiedBadge v={me.verified} /> : <UnverifiedBadge />}
          </div>
          <p className="small" style={{ marginTop: 6 }}>
            {[me.position, me.department, me.institution].filter(Boolean).join(", ")}
          </p>
          <p className="small soft">
            {me.field}, {me.country}
          </p>
        </div>
        <div className="btns" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <LinkedInLink url={me.linkedin} className="btn icon-btn" />
          <ScholarLink url={me.scholar} className="btn icon-btn" />
          <a className="btn btn-blue" href="#/profile">
            Edit profile
          </a>
        </div>
        {me.metrics ? (
          <div className="stats-box">
            <Radar m={me.metrics} size={190} labels />
            <div>
              <div className="small" style={{ fontWeight: 600 }}>
                Publication stats
              </div>
              <p className="small soft">From OpenAlex, updated {fmtDate(me.metrics.updatedAt)}.</p>
              <button className="btn" onClick={onScholar}>
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <div className="stats-box empty-box">
            <div>
              <div className="small" style={{ fontWeight: 600 }}>
                Publication stats
              </div>
              <p className="small soft">
                Add your ORCID iD and we'll pull your publication and citation figures from OpenAlex, shown as a small chart on your profile card.
              </p>
              <button className="btn btn-blue" onClick={onScholar}>
                Add publication stats
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="dash-sec">
        <div className="intro">
          <div>
            <h2>Your research groups</h2>
            <p className="soft small">Groups you lead or have been added to.</p>
          </div>
          <a className="btn btn-blue" href="#/groups/new">
            Create a research group
          </a>
        </div>
        {myGroups.length ? (
          <div className="list">
            {myGroups.map((g) => {
              const myRole = g.members.find((m) => m.researcherId === me.id)?.role || "Member";
              return (
                <div className="item" key={g.id}>
                  <div>
                    <h3>{g.name}</h3>
                    <div className="small soft">
                      {myRole}, {plural(memberResearchers(g).length, "member", "members")}
                    </div>
                  </div>
                  <div className="btns">
                    <a className="btn" href={groupHref(g)}>
                      View page
                    </a>
                    {canEditGroup(g) && (
                      <a className="btn btn-blue" href={`${groupHref(g)}/edit`}>
                        Edit
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty" style={{ padding: 30 }}>
            <div>You're not in any groups yet. Create one, or ask a group lead to add you with @{me.handle}.</div>
          </div>
        )}
      </section>

      <section className="dash-sec">
        <div className="intro">
          <div>
            <h2>Your studies</h2>
            <p className="soft small">Pick a study to see who has applied. Only you can see your applicants.</p>
          </div>
          {me.verified ? (
            <button className="btn btn-solid" onClick={onNewStudy}>
              Post a new study
            </button>
          ) : (
            <button className="btn btn-solid" onClick={onVerify} title="Only verified researchers can post studies">
              Verify to post a study
            </button>
          )}
        </div>
        {myStudies.length ? (
          <>
            <div className="list" style={{ marginBottom: 18 }}>
              {myStudies.map((s) => (
                <div className={"item" + (s.id === dashStudy ? " sel" : "")} key={s.id}>
                  <div>
                    <h3>{s.title}</h3>
                    <div className="small soft">
                      Posted {fmtDate(s.postedAt)}, {plural(appCount(s.id), "applicant", "applicants")}
                    </div>
                    <div className="badges" style={{ marginTop: 6 }}>
                      <DeadlinePill study={s} />
                      {!isOpen(s) ? (
                        <span className="unverified">Closed to new applicants</span>
                      ) : !isVisible(s) ? (
                        <span className="unverified">Hidden from participants until you verify</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="btns">
                    <button
                      className="btn"
                      onClick={() => {
                        setPicked(s.id);
                        setTimeout(() => applicantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                      }}
                    >
                      Applicants
                    </button>
                    <button className="btn btn-blue" onClick={() => onEditStudy(s)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => onDeleteStudy(s)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="dashbar">
              <strong>{byId("studies", dashStudy)?.title || ""}</strong>
              <button className="btn" style={{ marginLeft: "auto" }} onClick={exportCSV} disabled={!apps?.length}>
                <Icon.down /> Export CSV
              </button>
            </div>
            <div id="applicants" ref={applicantsRef}>
              {appsError ? (
                <div className="empty" style={{ padding: 30 }}>
                  <div>{appsError}</div>
                </div>
              ) : apps === null ? (
                <div className="loading" style={{ padding: 30 }}>
                  Loading applicants…
                </div>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Age</th>
                        <th>Country</th>
                        <th>Notes</th>
                        <th>Applied</th>
                        <th>Track record</th>
                        <th>Status</th>
                        <th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apps.length ? (
                        apps.map((a) => (
                          <tr key={a.id}>
                            <td>{a.name}</td>
                            <td>{a.email}</td>
                            <td>{a.age}</td>
                            <td>{a.country}</td>
                            <td style={{ maxWidth: 260 }}>{a.notes}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {a.ratingSummary?.count ? (
                                `★ ${a.ratingSummary.average} (${plural(a.ratingSummary.count, "rating", "ratings")})`
                              ) : (
                                <span className="soft">No ratings yet</span>
                              )}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {a.status === "withdrawn" ? <span className="unverified">Withdrew {fmtDate(a.withdrawnAt)}</span> : "Active"}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {dashClosed && a.status !== "withdrawn" && onRate && (
                                <button className="link small" onClick={() => onRate(a, dashStudyObj)}>
                                  {a.rating ? `★ ${a.rating.stars}. Edit` : "Rate"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="9" className="soft" style={{ textAlign: "center", padding: 36 }}>
                            No applications yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty" style={{ padding: 30 }}>
            <div>You haven't posted any studies yet.</div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ================= profile editor ================= */
export function ProfileEditor({ onVerify, onScholar, onRor }) {
  const { backend, toast } = useUI();
  const [handleAuto, setHandleAuto] = useState(!AUTH.researcher?.handle);
  const [handle, setHandle] = useState(AUTH.researcher?.handle || "");
  const [inst, setInst] = useState({ name: AUTH.researcher?.institution || "", ror: AUTH.researcher?.ror || "" });
  if (!AUTH.user)
    return (
      <div className="wrap">
        <SignInPrompt title="Your researcher profile" text="Sign in to create or edit your researcher profile." />
      </div>
    );
  const p = AUTH.researcher || { name: AUTH.user.name && !/@/.test(AUTH.user.name) ? AUTH.user.name : "", email: AUTH.user.email || "" };
  const isNew = !AUTH.researcher;
  return (
    <div className="wrap">
      <div className="editor">
        <a className="back" href="#/dashboard">
          ← Researcher area
        </a>
        <h1 style={{ marginTop: 14 }}>{isNew ? "Set up your researcher profile" : "Edit your profile"}</h1>
        <p className="soft lead">This is what appears in the researcher directory and on the groups you belong to. Fields marked * are required.</p>
        <Form
          id="profile-form"
          onSubmit={async (d) => {
            await backend.saveProfile({
              name: d.name,
              handle: d.handle.replace(/^@/, ""),
              position: d.position,
              institution: inst.name,
              ror: inst.ror,
              department: d.department,
              country: d.country,
              field: d.field,
              email: d.email,
              linkedin: d.linkedin,
              scholar: d.scholar,
              orcid: (d.orcid || "").replace(/^https?:\/\/orcid\.org\//i, ""),
              bio: d.bio,
            });
            toast(AUTH.researcher ? "Profile saved." : "Profile published.");
            await backend.refreshMe?.();
            const next = sessionStorage.getItem("after-profile");
            sessionStorage.removeItem("after-profile");
            navigate(next || "#/dashboard");
          }}
        >
          <div className="fsec">
            <h2>About you</h2>
            <p className="hint">Other researchers find you, and add you to groups, by name or @handle.</p>
            <div className="stack">
              <div className="row2">
                <Field label="Full name" required>
                  <input
                    name="name"
                    required
                    maxLength="120"
                    defaultValue={p.name || ""}
                    autoComplete="name"
                    placeholder="Dr. Jane Doe"
                    onChange={(e) => handleAuto && setHandle(makeHandle(e.target.value))}
                  />
                </Field>
                <Field
                  label="Handle"
                  required
                  hint={<div className="counter" style={{ textAlign: "left" }}>Lowercase letters, numbers and hyphens</div>}
                >
                  <div className="prefix">
                    <b>@</b>
                    <input
                      name="handle"
                      required
                      pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
                      maxLength="40"
                      value={handle}
                      onChange={(e) => {
                        setHandleAuto(false);
                        setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      }}
                    />
                  </div>
                </Field>
              </div>
              <ChoiceField label="Position" name="position" options={POSITIONS} required defaultValue={p.position} />
              <Field label="Short bio" required>
                <textarea name="bio" rows="3" required maxLength="600" defaultValue={p.bio || ""} placeholder="What are you working on right now?" />
              </Field>
            </div>
          </div>
          <div className="fsec">
            <h2>Institution</h2>
            <div className="stack">
              <div className="row2">
                <InstitutionField value={inst} onFind={() => onRor(inst.name, (hit) => setInst({ name: hit.name, ror: hit.ror }))} />
                <Field label="Department or school">
                  <input name="department" maxLength="160" defaultValue={p.department || ""} />
                </Field>
              </div>
              <div className="row2">
                <ChoiceField label="Country" name="country" options={COUNTRY_NAMES} required defaultValue={p.country} />
                <ChoiceField label="Field of research" name="field" options={FIELDS} required defaultValue={p.field} />
              </div>
            </div>
          </div>
          <div className="fsec">
            <h2>Contact</h2>
            <div className="stack">
              <div className="row2">
                <Field label="Email" required>
                  <input name="email" type="email" required defaultValue={p.email || ""} />
                </Field>
                <Field label="LinkedIn">
                  <input
                    name="linkedin"
                    type="url"
                    maxLength="500"
                    pattern="https?://([a-z]{2,3}\.)?linkedin\.com/(in|pub)/.+"
                    defaultValue={p.linkedin || ""}
                    placeholder="https://www.linkedin.com/in/your-name"
                  />
                </Field>
              </div>
              <Field label="Google Scholar profile">
                <input name="scholar" type="url" maxLength="500" defaultValue={p.scholar || ""} placeholder="https://scholar.google.com/citations?user=…" />
              </Field>
            </div>
          </div>
          <div className="fsec">
            <h2>Publication stats</h2>
            <p className="hint">
              Your ORCID iD lets us pull your publication and citation figures from OpenAlex, the open scholarly database. They appear as a small chart
              on your card in the directory. Google Scholar has no public data feed, so the Scholar link above is shown as a link only.
            </p>
            <div className="stack">
              <Field label="ORCID iD">
                <input
                  name="orcid"
                  maxLength="60"
                  pattern="(https?://orcid\.org/)?\d{4}-\d{4}-\d{4}-\d{3}[0-9Xx]"
                  defaultValue={p.orcid || ""}
                  placeholder="0000-0002-1825-0097"
                />
              </Field>
            </div>
            {p.metrics ? (
              <div className="stats-box" style={{ marginTop: 14 }}>
                <Radar m={p.metrics} size={190} labels />
                <div>
                  <p className="small soft">From OpenAlex, updated {fmtDate(p.metrics.updatedAt)}.</p>
                  <button type="button" className="btn" onClick={onScholar}>
                    Refresh stats
                  </button>
                </div>
              </div>
            ) : isNew ? (
              <p className="hint" style={{ margin: "12px 0 0" }}>
                Once your profile is published you can pull your stats in.
              </p>
            ) : (
              <button type="button" className="btn btn-blue" style={{ marginTop: 12 }} onClick={onScholar}>
                Fetch stats from OpenAlex
              </button>
            )}
          </div>
          <div className="fsec">
            <h2>Verification</h2>
            {isNew ? (
              <p className="hint" style={{ margin: 0 }}>
                Once your profile is published you can verify your institution email to get the Verified badge.
              </p>
            ) : p.verified ? (
              <>
                <div className="badges">
                  <VerifiedBadge v={p.verified} />
                </div>
                <p className="hint" style={{ margin: "10px 0 0" }}>
                  Verified on {fmtDate(p.verified.at)}. Changing your institution removes the badge until you verify again.
                </p>
              </>
            ) : (
              <>
                <p className="hint">Confirm an email address at your institution to get the Verified badge on your profile and studies.</p>
                <button type="button" className="btn btn-blue" onClick={onVerify}>
                  Verify institution email
                </button>
              </>
            )}
          </div>
          <div className="actions">
            <SubmitButton className="btn btn-solid">{isNew ? "Publish profile" : "Save changes"}</SubmitButton>
            <a className="btn" href="#/dashboard">
              Cancel
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
}

/* ================= group editor ================= */
export function GroupEditor({ route, onRor, onDelete }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const editing = route.id !== "new";
  const g = editing ? groupByRef(route.id) : null;

  const [members, setMembers] = useState(() =>
    editing && g ? g.members.map((m) => ({ ...m })) : me ? [{ researcherId: me.id, role: "Group lead", canEdit: true }] : []
  );
  const [pubs, setPubs] = useState(() =>
    editing && g ? (g.publications || []).map((p) => ({ ...p, authorNames: p.authorNames?.length ? [...p.authorNames] : namesFromHarvard(p.authors) })) : []
  );
  const [openings, setOpenings] = useState(() => (editing && g ? (g.openings || []).map((o) => ({ ...o })) : []));
  const [inst, setInst] = useState({ name: g?.institution || me?.institution || "", ror: g?.ror || "", rorName: g?.rorName || "" });
  const [summaryLen, setSummaryLen] = useState((g?.summary || "").length);
  const [mention, setMention] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const formRef = useRef(null);

  if (!AUTH.user)
    return (
      <div className="wrap">
        <SignInPrompt title="Create a research group" text="Sign in to create or edit a research group." />
      </div>
    );
  if (!me) {
    sessionStorage.setItem("after-profile", location.hash);
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Create a research group</h1>
            <p className="soft">You need a researcher profile before you can create a group.</p>
          </div>
        </div>
        <SetupPrompt />
      </div>
    );
  }
  if (editing && !g)
    return (
      <div className="wrap">
        <a className="back" href="#/groups">
          ← Research groups
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>This group isn't listed any more.</div>
        </div>
      </div>
    );
  if (editing && !canEditGroup(g))
    return (
      <div className="wrap">
        <a className="back" href={groupHref(g)}>
          ← {g.name}
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>Only the group's owner and members with edit access can change this page.</div>
        </div>
      </div>
    );

  const ownerId = editing ? g.ownerId : me.id;
  const v = g || { institution: me.institution, country: me.country, field: me.field, email: me.email };
  const year = new Date().getFullYear();

  const taken = new Set(members.map((m) => m.researcherId));
  const q = mention.replace(/^@+/, "").trim().toLowerCase();
  const hits = S.researchers
    .filter((r) => !taken.has(r.id) && (!q || [r.name, r.handle || "", r.institution].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => ((b.handle || "").startsWith(q) - (a.handle || "").startsWith(q)) || sortName(a.name).localeCompare(sortName(b.name)))
    .slice(0, 7);
  const showMention = mentionOpen && (mention.startsWith("@") || mention.trim().length >= 2);

  function pickMember(id) {
    if (!members.some((m) => m.researcherId === id)) setMembers([...members, { researcherId: id, role: "Member", canEdit: false }]);
    setMention("");
    setMentionIdx(0);
    const r = byId("researchers", id);
    if (r) toast(`${r.name} added. Set their role below.`);
  }
  const setMember = (i, k, val) => setMembers(members.map((m, j) => (j === i ? { ...m, [k]: val } : m)));
  const setPub = (i, k, val) => setPubs(pubs.map((p, j) => (j === i ? { ...p, [k]: val } : p)));
  const setOpening = (i, k, val) => setOpenings(openings.map((o, j) => (j === i ? { ...o, [k]: val } : o)));

  return (
    <div className="wrap">
      <div className="editor">
        <a className="back" href={editing ? groupHref(g) : "#/dashboard"}>
          ← {editing ? g.name : "Researcher area"}
        </a>
        <h1 style={{ marginTop: 14 }}>{editing ? "Edit group page" : "Create a research group"}</h1>
        <p className="soft lead">Everything here appears on the group's page. Fields marked * are required.</p>
        <Form
          id="group-form"
          onSubmit={async (d) => {
            const body = {
              name: d.name,
              institution: inst.name,
              ror: inst.ror,
              rorName: inst.rorName,
              country: d.country,
              field: d.field,
              founded: d.founded ? Number(d.founded) : null,
              email: d.email,
              website: d.website,
              summary: d.summary,
              about: d.about,
              focus: uniq((d.focus || "").split(",").map((x) => x.trim())).slice(0, 12),
              grants: d.grants ? Number(d.grants) : 0,
              members: members.map((m) => ({ researcherId: m.researcherId, role: (m.role || "Member").trim(), canEdit: !!m.canEdit })),
              publications: pubs.map((p) => ({
                title: p.title.trim(),
                authorNames: (p.authorNames || []).map((n) => n.trim()).filter(Boolean),
                venue: p.venue.trim(),
                year: Number(p.year),
                url: (p.url || "").trim(),
              })),
              openings: openings.map((o) => ({ type: o.type || "Other", title: o.title.trim(), detail: (o.detail || "").trim(), deadline: o.deadline || "" })),
            };
            const saved = await backend.saveGroup(body, editing ? g.id : null);
            toast(editing ? "Group page saved." : "Group page published.");
            navigate(groupHref(saved));
          }}
        >
          <div ref={formRef}>
            <div className="fsec">
              <h2>The basics</h2>
              <p className="hint">Shown at the top of the group page and on its card.</p>
              <div className="stack">
                <Field label="Group name" required>
                  <input name="name" required maxLength="140" defaultValue={v.name || ""} placeholder="e.g. Human–AI Interaction Lab" />
                </Field>
                <InstitutionField value={inst} onFind={() => onRor(inst.name, (hit) => setInst({ name: hit.name, ror: hit.ror, rorName: hit.name }))} />
                <div className="row2">
                  <ChoiceField label="Country" name="country" options={COUNTRY_NAMES} required defaultValue={v.country} />
                  <ChoiceField label="Field" name="field" options={FIELDS} required defaultValue={v.field} />
                </div>
                <div className="row2">
                  <Field label="Year founded">
                    <input name="founded" type="number" min="1800" max={year} defaultValue={v.founded || ""} />
                  </Field>
                </div>
                <div className="row2">
                  <Field label="Contact email" required>
                    <input name="email" type="email" required defaultValue={v.email || ""} />
                  </Field>
                  <Field label="Website">
                    <input name="website" type="url" defaultValue={v.website || ""} placeholder="https://" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="fsec">
              <h2>Describe the group</h2>
              <div className="stack">
                <Field label="One-line summary" required hint={<div className="counter" id="sum-count">{summaryLen} / 180</div>}>
                  <input
                    name="summary"
                    required
                    maxLength="180"
                    defaultValue={v.summary || ""}
                    placeholder="What the group studies, in one sentence"
                    onChange={(e) => setSummaryLen(e.target.value.length)}
                  />
                </Field>
                <Field label="About the group" required>
                  <textarea name="about" rows="5" required maxLength="3000" defaultValue={v.about || ""} placeholder="What you study, how, and who you work with" />
                </Field>
                <Field label="Research focus">
                  <input
                    name="focus"
                    maxLength="500"
                    defaultValue={(v.focus || []).join(", ")}
                    placeholder="Separate areas with commas, e.g. Trust calibration, Online experiments"
                  />
                </Field>
              </div>
            </div>

            <div className="fsec">
              <h2>Who's in the group</h2>
              <p className="hint">Type @ and start typing a name or handle to add a registered researcher. People need a HumAIn Labs profile before they can be added.</p>
              <div id="member-rows">
                {members.map((m, i) => {
                  const r = byId("researchers", m.researcherId);
                  if (!r) return null;
                  const owner = m.researcherId === ownerId;
                  return (
                    <div className="mrow" key={m.researcherId}>
                      <Avatar name={r.name} size={36} />
                      <div className="who2">
                        <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{r.name}</div>
                        <div className="handle">
                          @{r.handle}, {r.institution}
                        </div>
                      </div>
                      <input
                        className="role"
                        list="roles"
                        value={m.role}
                        onChange={(e) => setMember(i, "role", e.target.value)}
                        aria-label={`Role for ${r.name}`}
                        maxLength="80"
                      />
                      <label className="ce" title={owner ? "The group's creator can always edit" : "Let this person edit the group page"}>
                        <input type="checkbox" checked={!!m.canEdit || owner} disabled={owner} onChange={(e) => setMember(i, "canEdit", e.target.checked)} /> Can
                        edit
                      </label>
                      {owner ? (
                        <span className="small soft" style={{ width: 38, textAlign: "center" }}>
                          Owner
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn icon-btn"
                          onClick={() => setMembers(members.filter((_, j) => j !== i))}
                          aria-label={`Remove ${r.name}`}
                        >
                          <Icon.x />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mention">
                <input
                  id="mention"
                  autoComplete="off"
                  placeholder="@ Add a member"
                  role="combobox"
                  aria-expanded={showMention}
                  aria-controls="mention-list"
                  aria-autocomplete="list"
                  aria-label="Add a member with @"
                  aria-activedescendant={showMention && hits.length ? `opt-${mentionIdx}` : undefined}
                  value={mention}
                  onFocus={() => {
                    setMentionOpen(true);
                    if (!mention) setMention("@");
                  }}
                  onBlur={() =>
                    setTimeout(() => {
                      setMentionOpen(false);
                      setMention((m) => (m === "@" ? "" : m));
                    }, 150)
                  }
                  onChange={(e) => {
                    setMention(e.target.value.replace(/^@+/, "@"));
                    setMentionIdx(0);
                    setMentionOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (!showMention) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIdx(Math.min(mentionIdx + 1, hits.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIdx(Math.max(mentionIdx - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (hits[mentionIdx]) pickMember(hits[mentionIdx].id);
                    } else if (e.key === "Escape") {
                      e.stopPropagation();
                      setMentionOpen(false);
                    }
                  }}
                />
                <ul className="mlist" id="mention-list" role="listbox" hidden={!showMention}>
                  {hits.length ? (
                    hits.map((r, i) => (
                      <li
                        key={r.id}
                        role="option"
                        id={`opt-${i}`}
                        data-pick={r.id}
                        aria-selected={i === mentionIdx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickMember(r.id);
                        }}
                      >
                        <Avatar name={r.name} size={30} />
                        <div>
                          <div className="nm">
                            {r.name} <span className="handle">@{r.handle}</span>
                          </div>
                          <div className="sub">{[r.position, r.institution].filter(Boolean).join(", ")}</div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="none">
                      {q ? `No registered researcher matches “${q}”. They need to create a profile first.` : "Everyone registered is already in this group."}
                    </li>
                  )}
                </ul>
              </div>
              <datalist id="roles">
                {ROLE_SUGGESTIONS.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>

            <div className="fsec">
              <h2>Track record</h2>
              <p className="hint">
                Members, publications, active studies and participants recruited are counted automatically. Citations are summed from your members'
                OpenAlex figures, so each member should add their ORCID iD to their own profile.
              </p>
              <div className="row2">
                <Field label="Active grants">
                  <input name="grants" type="number" min="0" defaultValue={v.grants ?? ""} />
                </Field>
              </div>
            </div>

            <div className="fsec">
              <h2>Publications</h2>
              <p className="hint">Listed newest first on the group page.</p>
              <div id="pubs">
                {pubs.length ? (
                  pubs.map((p, i) => (
                    <div className="rep" key={i}>
                      <div className="rep-head">
                        <span>Publication {i + 1}</span>
                        <button type="button" className="link small" onClick={() => setPubs(pubs.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      </div>
                      <Field label="Title" required>
                        <input data-p={i} data-k="title" required maxLength="300" value={p.title} onChange={(e) => setPub(i, "title", e.target.value)} />
                      </Field>
                      <div className="f field-stack">
                        <span className="req">Authors</span>
                        <AuthorNames names={p.authorNames || [""]} onChange={(names) => setPub(i, "authorNames", names)} />
                      </div>
                      <div className="row2">
                        <Field label="Journal or venue" required>
                          <input data-p={i} data-k="venue" required maxLength="200" value={p.venue} onChange={(e) => setPub(i, "venue", e.target.value)} />
                        </Field>
                        <Field label="Year" required>
                          <input data-p={i} data-k="year" type="number" required min="1900" max={year + 1} value={p.year} onChange={(e) => setPub(i, "year", e.target.value)} />
                        </Field>
                      </div>
                      <Field label="Link">
                        <input data-p={i} data-k="url" type="url" value={p.url || ""} onChange={(e) => setPub(i, "url", e.target.value)} placeholder="https://doi.org/…" />
                      </Field>
                    </div>
                  ))
                ) : (
                  <p className="rep-empty">No publications added.</p>
                )}
              </div>
              <button type="button" className="btn" onClick={() => setPubs([...pubs, { title: "", authorNames: [""], venue: "", year: "", url: "" }])}>
                Add a publication
              </button>
            </div>

            <div className="fsec">
              <h2>Looking for</h2>
              <p className="hint">Jobs and collaborations. Studies you link to this group show up here automatically.</p>
              <div id="openings">
                {openings.length ? (
                  openings.map((o, i) => (
                    <div className="rep" key={i}>
                      <div className="rep-head">
                        <span>Opening {i + 1}</span>
                        <button type="button" className="link small" onClick={() => setOpenings(openings.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      </div>
                      <div className="row2">
                        <Field label="Type">
                          <select data-o={i} data-k="type" value={o.type} onChange={(e) => setOpening(i, "type", e.target.value)}>
                            {OPENING_TYPES.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Apply by">
                          <input data-o={i} data-k="deadline" type="date" value={o.deadline || ""} onChange={(e) => setOpening(i, "deadline", e.target.value)} />
                        </Field>
                      </div>
                      <Field label="Title" required>
                        <input data-o={i} data-k="title" required maxLength="160" value={o.title} onChange={(e) => setOpening(i, "title", e.target.value)} placeholder="e.g. Funded PhD in AI security" />
                      </Field>
                      <Field label="Details">
                        <textarea data-o={i} data-k="detail" rows="2" maxLength="600" value={o.detail || ""} onChange={(e) => setOpening(i, "detail", e.target.value)} />
                      </Field>
                    </div>
                  ))
                ) : (
                  <p className="rep-empty">No openings right now.</p>
                )}
              </div>
              <button type="button" className="btn" onClick={() => setOpenings([...openings, { type: "PhD position", title: "", detail: "", deadline: "" }])}>
                Add an opening
              </button>
            </div>

            <div className="actions">
              <SubmitButton className="btn btn-solid">{editing ? "Save changes" : "Publish group page"}</SubmitButton>
              <a className="btn" href={editing ? groupHref(g) : "#/dashboard"}>
                Cancel
              </a>
              <span className="spacer" />
              {editing && g.ownerId === me.id && (
                <button type="button" className="btn btn-danger" onClick={() => onDelete(g)}>
                  Delete group
                </button>
              )}
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}

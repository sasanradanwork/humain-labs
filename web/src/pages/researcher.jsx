// The researcher side: directory, group pages, the group editor and the researcher area.
import { useEffect, useRef, useState } from "react";
import { Avatar, Icon, LinkedInLink, Radar, ScholarLink, Cover, DeadlinePill, VerifiedBadge, UnverifiedBadge, sortByName } from "../components/ui.jsx";
import { GroupCard, ResearcherCard, Toolbar, groupHref, researcherHref, lookingFor, APP_STAGES } from "../components/cards.jsx";
import { AUTH, S, appCount, byId, canEditGroup, groupStudies, groupsOf, memberResearchers, role } from "../lib/store.js";
import { DAY_MS, fmtDate, FORMATS, gidKey, isOpen, makeHandle, matches, normCountry, OPENING_TYPES, plural, ROLE_SUGGESTIONS, sortName, today, uniq } from "../lib/util.js";
import { Field, Form, SubmitButton, navigate, replaceRoute, useUI } from "../lib/ui.jsx";
import { AuthorNames, ChoiceField, InstitutionField } from "../components/fields.jsx";
import { HlgBadge } from "../components/hlg.jsx";
import { Repeater, YearSpan } from "../components/repeater.jsx";
import { cleanDoi, lookupDoi } from "../lib/doi.js";
import { IdCheckPanel } from "../components/idcheck.jsx";
import { COUNTRY_NAMES, DISCIPLINES, FIELDS, POSITIONS } from "../lib/lists.js";
import { namesFromHarvard } from "../lib/harvard.js";
import { ResearcherGate, isVisible } from "./public.jsx";
import { FEE_PERCENT, feeBreakdown, gbp } from "../lib/money.js";

export function groupByRef(ref) {
  if (!ref) return null;
  const key = gidKey(ref);
  return S.groups.find((g) => g.publicId && gidKey(g.publicId) === key) || S.groups.find((g) => g.id === ref) || null;
}

/* ================= researcher directory ================= */
export function Researchers({ filters, setFilters }) {
  const guest = role() !== "researcher";
  const f = filters;
  // Your own card is not in the directory: your profile lives under Profile, so the
  // list is other people. Visitors see only the profiles set to public.
  const everyone = S.researchers.filter(
    (r) => r.id !== AUTH.researcher?.id && (!guest || r.visibility === "public")
  );
  const list = everyone
    .filter(
      (r) =>
        matches(f.q, [r.name, "@" + r.handle, r.position, r.institution, r.department, r.field, r.country, r.bio]) &&
        (!f.field || r.field === f.field) &&
        (!f.discipline || r.discipline === f.discipline) &&
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
          <p className="soft">
            {guest
              ? "Researchers who have chosen to be listed publicly. Sign in as a researcher to see everyone."
              : "Researchers across universities and countries. Open a card for their full profile, or see how the year is going on the leaderboard."}
          </p>
        </div>
        <div className="intro-btns">
          {!guest && (
            <a className="btn" href="#/researchers/leaderboard">
              <Icon.trophy /> Leaderboard
            </a>
          )}
          {guest ? (
            <a className="btn btn-blue" href="#/profile/edit">
              <Icon.people /> Join as a researcher
            </a>
          ) : (
            <a className="btn btn-blue" href="#/profile">
              <Icon.pencil /> Your profile
            </a>
          )}
        </div>
      </div>
      <Toolbar
        page="researchers"
        filters={filters}
        setFilters={setFilters}
        hint="Search by name, @handle or topic"
        noun={["researcher", "researchers"]}
        count={list.length}
        total={everyone.length}
        toggle={{ key: "verified", label: "Verified only" }}
        defs={[
          ["discipline", "All disciplines", DISCIPLINES.filter((d) => everyone.some((r) => r.discipline === d))],
          ["field", "All fields", uniq(everyone.map((r) => r.field))],
          ["institution", "All institutions", uniq(everyone.map((r) => r.institution))],
          ["country", "All countries", uniq(everyone.map((r) => r.country))],
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
  const f = filters;
  // Signed-out visitors and participants see only public group pages.
  const pool = AUTH.researcher ? S.groups : S.groups.filter((g) => g.visibility === "public");
  const list = pool
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
        {AUTH.researcher && (
          <a className="btn btn-blue" href="#/groups/new">
            Create a research group
          </a>
        )}
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
  const openings = g.openings || [];
  const mem = memberResearchers(g);
  // Public pages for visitors carry a member count only; names are shown to signed-in researchers.
  const memberTotal = g.members ? mem.length : g.memberCount || 0;
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
          <b>{memberTotal}</b>
          <span>Members</span>
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
        </div>
        <aside>
          <section className="sec">
            <div className="sec-head">
              <h2>Who's in the group</h2>
              <a className="link small" href="#/researchers">
                All researchers →
              </a>
            </div>
            <div className="members">
              {!g.members && <p className="soft small">Members are shown to signed-in researchers.</p>}
              {mem.map((m) => (
                <div className="person" key={m.researcherId}>
                  <Avatar name={m.r.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: ".92rem" }}>
                      <a className="plain" href={researcherHref(m.r)}>
                        {m.r.name}
                      </a>
                    </div>
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
    <a className="btn btn-solid" href="#/profile/edit">
      Set up profile
    </a>
  </div>
);

export function Dashboard({ onVerify, onScholar }) {
  const me = AUTH.researcher;
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
          <a className="btn btn-blue" href="#/profile/edit">
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
            <p className="soft small">Studies are posted and managed on the Studies page, where you can also see who has applied.</p>
          </div>
          <a className="btn btn-solid" href="#/studies">
            Go to studies
          </a>
        </div>
      </section>
    </div>
  );
}

// A date that is fixed once the study is posted, shown as plain text in its place.
function LockedDate({ label, value }) {
  return (
    <Field label={label}>
      <p className="locked-val">
        {value ? fmtDate(value) : "Not set"} <span className="small soft">fixed</span>
      </p>
    </Field>
  );
}

// What the researcher pays and where it goes, worked out as they type.
function CostPreview({ budget, participantsWanted, rewardEach }) {
  const split = feeBreakdown(budget, participantsWanted, rewardEach);
  const n = Number(participantsWanted) || 0;
  return (
    <div className="cost" aria-live="polite">
      <div className="cost-row">
        <span>Study budget, paid up front</span>
        <b>{gbp(split.budget)}</b>
      </div>
      <div className="cost-row">
        <span>Platform fee ({FEE_PERCENT})</span>
        <b>&minus;{gbp(split.fee)}</b>
      </div>
      <div className="cost-row sum">
        <span>Left for participants</span>
        <b>{gbp(split.available)}</b>
      </div>
      <div className="cost-row">
        <span>
          {n || 0} {n === 1 ? "participant" : "participants"} &times; {gbp(rewardEach)}
        </span>
        <b>{gbp(split.allocated)}</b>
      </div>
      <div className={"cost-row sum" + (split.overspent ? " over" : "")}>
        <span>{split.overspent ? "Over budget by" : "Not allocated"}</span>
        <b>{gbp(Math.abs(split.unallocated))}</b>
      </div>
      <p className="small soft" style={{ margin: "10px 0 0" }}>
        {split.overspent
          ? "Raise the budget, ask for fewer participants, or lower the reward."
          : `Each participant is paid ${gbp(rewardEach)} as they complete the study. If you don't fill all ${n || 0} places, the rewards you don't use are refunded to whatever you paid with.`}
      </p>
    </div>
  );
}

export function StudyEditor({ route, onDelete }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const editing = route.id !== "new";
  const existing = editing ? byId("studies", route.id) : null;
  const canEdit = !editing || (!!existing && !!me && existing.researcherId === me.id);

  if (!AUTH.user)
    return (
      <div className="wrap">
        <SignInPrompt title="Post a study" text="Sign in with your researcher account to post or change a study." />
      </div>
    );
  if (!me) {
    sessionStorage.setItem("after-profile", location.hash);
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Post a study</h1>
            <p className="soft">You need a researcher profile before you can post a study.</p>
          </div>
        </div>
        <SetupPrompt />
      </div>
    );
  }
  if (!canEdit)
    return (
      <div className="wrap">
        <a className="back" href="#/studies">
          &larr; Studies
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>This study doesn't exist, or it was posted by another researcher.</div>
        </div>
      </div>
    );
  // Unverified researchers can look around but not post.
  if (!(me.verified && me.idVerified))
    return (
      <div className="wrap">
        <a className="back" href="#/studies">
          &larr; Studies
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>View-only mode. Verify your institution email and identity to post or change a study.</div>
          <a className="btn btn-blue" href="#/dashboard">
            Go to your researcher area
          </a>
        </div>
      </div>
    );

  const s = existing || { field: me.field, country: me.country, format: "Online" };
  const mine = groupsOf(me.id);
  const maxDate = new Date(Date.now() + 365 * DAY_MS).toISOString().slice(0, 10);
  // Dates and money participants depend on are fixed once the study is posted.
  const locked = !!existing;
  const [money, setMoney] = useState({
    budget: s.budget ?? "",
    participantsWanted: s.participantsWanted ?? "",
    rewardEach: s.rewardEach ?? "",
  });
  const onMoney = (k) => (e) => setMoney((m) => ({ ...m, [k]: e.target.value }));
  const posted = locked ? feeBreakdown(s.budget, s.participantsWanted, s.rewardEach) : null;
  const back = existing ? `#/studies/${encodeURIComponent(existing.id)}` : "#/studies";
  return (
    <div className="wrap">
      <div className="editor">
        <a className="back" href={back}>
          &larr; {existing ? existing.title : "Studies"}
        </a>
        <h1 style={{ marginTop: 14 }}>{existing ? "Edit study" : "Post a new study"}</h1>
        <p className="soft lead">
          Posted as {me.name}, {me.institution}. Fields marked * are required.
        </p>
        <Form
          onSubmit={async (d) => {
            const saved = await backend.saveStudy(d, existing?.id);
            toast(existing ? "Study saved." : "Study published.");
            navigate(`#/studies/${encodeURIComponent(saved?.id || existing?.id || "")}`);
          }}
        >
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
              <Field label="Reward, as participants see it">
                <input name="compensation" maxLength="120" defaultValue={s.compensation || ""} placeholder="e.g. £20 bank transfer" />
              </Field>
              <Field label="Applications close on" required>
                <input name="closesAt" type="date" required min={today()} max={maxDate} defaultValue={s.closesAt || ""} />
              </Field>
            </div>

            <fieldset className="tl-form">
              <legend>Budget</legend>
              {locked ? (
                <>
                  <p className="small soft" style={{ marginTop: 0 }}>
                    The budget is fixed once a study is posted, because it is paid up front and participants are paid from it.
                  </p>
                  <div className="cost">
                    <div className="cost-row">
                      <span>Study budget</span>
                      <b>{gbp(posted.budget)}</b>
                    </div>
                    <div className="cost-row">
                      <span>Platform fee ({FEE_PERCENT})</span>
                      <b>&minus;{gbp(posted.fee)}</b>
                    </div>
                    <div className="cost-row sum">
                      <span>
                        {s.participantsWanted || 0} &times; {gbp(s.rewardEach)} for participants
                      </span>
                      <b>{gbp(posted.allocated)}</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Study budget (£)" required>
                    <input
                      name="budget"
                      type="number"
                      required
                      min="1"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      value={money.budget}
                      onChange={onMoney("budget")}
                      placeholder="e.g. 500"
                    />
                  </Field>
                  <div className="row2">
                    <Field label="Participants needed" required>
                      <input
                        name="participantsWanted"
                        type="number"
                        required
                        min="1"
                        max="10000"
                        step="1"
                        inputMode="numeric"
                        value={money.participantsWanted}
                        onChange={onMoney("participantsWanted")}
                        placeholder="e.g. 20"
                      />
                    </Field>
                    <Field label="Reward for each participant (£)" required>
                      <input
                        name="rewardEach"
                        type="number"
                        required
                        min="0.01"
                        max="100000"
                        step="0.01"
                        inputMode="decimal"
                        value={money.rewardEach}
                        onChange={onMoney("rewardEach")}
                        placeholder="e.g. 20"
                      />
                    </Field>
                  </div>
                  <CostPreview {...money} />
                </>
              )}
            </fieldset>

            <fieldset className="tl-form">
              <legend>Study timeline</legend>
              <div className="row2">
                <Field label="Eligibility window opens" required>
                  <input name="eligibilityStart" type="date" required min={today()} max={maxDate} defaultValue={s.eligibilityStart || ""} />
                </Field>
                <Field label="Eligibility window closes" required>
                  <input name="eligibilityEnd" type="date" required min={today()} max={maxDate} defaultValue={s.eligibilityEnd || ""} />
                </Field>
              </div>
              <div className="row2">
                <Field label="Experiment starts" required>
                  <input name="experimentStart" type="date" required min={today()} max={maxDate} defaultValue={s.experimentStart || ""} />
                </Field>
                <Field label="Experiment ends" required>
                  <input name="experimentEnd" type="date" required min={today()} max={maxDate} defaultValue={s.experimentEnd || ""} />
                </Field>
              </div>
              <div className="row2">
                {locked ? (
                  <LockedDate label="Validation complete by" value={s.validationEnd} />
                ) : (
                  <Field label="Validation complete by" required>
                    <input name="validationEnd" type="date" required min={today()} max={maxDate} defaultValue={s.validationEnd || ""} />
                  </Field>
                )}
                {locked ? (
                  <LockedDate label="Study ends on" value={s.endDate} />
                ) : (
                  <Field label="Study ends on" required>
                    <input name="endDate" type="date" required min={today()} max={maxDate} defaultValue={s.endDate || ""} />
                  </Field>
                )}
              </div>
              {locked && (
                <p className="small soft">
                  The validation and end dates are fixed, so participants know when they will be paid. The dates before them can still move, as long as
                  they stay in order.
                </p>
              )}
            </fieldset>

            <Field label="What's involved" required>
              <textarea name="description" rows="3" required maxLength="2000" defaultValue={s.description || ""} />
            </Field>
            <Field label="Who can take part" required>
              <input name="criteria" required maxLength="400" defaultValue={s.criteria || ""} placeholder="e.g. 18+, living in the UK" />
            </Field>
          </div>
          <div className="actions">
            <SubmitButton className="btn btn-solid">{existing ? "Save changes" : "Publish study"}</SubmitButton>
            <a className="btn" href={back}>
              Cancel
            </a>
            {existing && (
              <button type="button" className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={() => onDelete(existing)}>
                Remove study
              </button>
            )}
          </div>
        </Form>
      </div>
    </div>
  );
}


/* ================= manage one study ================= */
// The researcher's view of a study they posted: its money, who has applied, and the controls to change it.
export function ManageStudy({ route, onEditStudy, onDeleteStudy, onRate }) {
  const { backend, toast } = useUI();
  const me = AUTH.researcher;
  const study = byId("studies", route.id);
  const mine = !!study && !!me && study.researcherId === me.id;
  const [apps, setApps] = useState(null);
  const [appsError, setAppsError] = useState("");

  useEffect(() => {
    let live = true;
    setApps(null);
    setAppsError("");
    if (!mine) return;
    backend
      .applicants(study.id)
      .then((a) => live && setApps(a))
      .catch((e) => live && setAppsError(e.message));
    return () => {
      live = false;
    };
  }, [mine, study?.id, backend, S.applications.length, S.appsVersion]);

  if (!AUTH.user)
    return (
      <div className="wrap">
        <SignInPrompt title="Manage a study" text="Researchers sign in here to manage the studies they have posted." />
      </div>
    );
  if (!mine)
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>Study not found</h1>
            <p className="soft">This study doesn't exist, or it was posted by another researcher.</p>
          </div>
        </div>
        <div className="empty" style={{ padding: 30 }}>
          <a className="btn btn-blue" href="#/studies">
            Back to studies
          </a>
        </div>
      </div>
    );

  // Participants can be rated once the study has closed.
  const closed = !isOpen(study);
  const split = feeBreakdown(study.budget, study.participantsWanted, study.rewardEach);
  const live = (apps || []).filter((a) => a.status !== "withdrawn");
  const wanted = Number(study.participantsWanted) || 0;
  const filled = Math.min(live.length, wanted);
  const committed = (Number(study.rewardEach) || 0) * filled;
  const refundable = Math.max(0, split.allocated - committed);

  // Approve moves the participant to the next stage. Not eligible withdraws them.
  async function moveApplicant(a, action) {
    try {
      if (action === "advance") {
        await backend.advance(a.id);
        toast(`${a.name} moved to ${APP_STAGES[Math.min((a.stage ?? 0) + 1, APP_STAGES.length - 1)]}`);
      } else {
        if (!window.confirm(`Withdraw ${a.name} as not eligible? They won't go on to the study.`)) return;
        await backend.reject(a.id);
        toast(`${a.name} was withdrawn as not eligible`);
      }
    } catch (e) {
      toast(e.message);
    }
  }
  async function exportCSV() {
    const s = study;
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
          <a className="small" href="#/studies">
            &larr; All studies
          </a>
          <h1>{study.title}</h1>
          <p className="soft">
            Posted {fmtDate(study.postedAt)}, {plural(appCount(study.id), "applicant", "applicants")}
          </p>
          <div className="badges" style={{ marginTop: 6 }}>
            <DeadlinePill study={study} />
            {closed ? (
              <span className="unverified">Closed to new applicants</span>
            ) : !isVisible(study) ? (
              <span className="unverified">Hidden from participants until you verify</span>
            ) : null}
          </div>
        </div>
        <div className="btns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-blue" onClick={() => onEditStudy(study)}>
            Edit
          </button>
          <button className="btn btn-danger" onClick={() => onDeleteStudy(study)}>
            Remove
          </button>
        </div>
      </div>

      <section className="dash-sec">
        <div className="intro">
          <div>
            <h2>Budget</h2>
            <p className="soft small">Paid up front when the study is posted. Fixed once it is live.</p>
          </div>
        </div>
        <div className="cost">
          <div className="cost-row">
            <span>Study budget</span>
            <b>{gbp(split.budget)}</b>
          </div>
          <div className="cost-row">
            <span>Platform fee ({FEE_PERCENT})</span>
            <b>&minus;{gbp(split.fee)}</b>
          </div>
          <div className="cost-row sum">
            <span>
              Rewards for {wanted} {wanted === 1 ? "participant" : "participants"} &times; {gbp(study.rewardEach)}
            </span>
            <b>{gbp(split.allocated)}</b>
          </div>
          <div className="cost-row">
            <span>
              Places filled, {filled} of {wanted}
            </span>
            <b>{gbp(committed)}</b>
          </div>
          <div className="cost-row sum">
            <span>Refunded if the rest go unfilled</span>
            <b>{gbp(refundable)}</b>
          </div>
        </div>
      </section>

      <section className="dash-sec">
        <div className="dashbar">
          <strong>Applicants</strong>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={exportCSV} disabled={!apps?.length}>
            <Icon.down /> Export CSV
          </button>
        </div>
        <div id="applicants">
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
                    <th>Progress</th>
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
                          {a.status === "withdrawn" ? (
                            <span className="unverified">
                              {a.withdrawReason === "eligibility" ? "Not eligible" : "Withdrew"} {fmtDate(a.withdrawnAt)}
                            </span>
                          ) : (
                            APP_STAGES[a.stage ?? 0]
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {a.status !== "withdrawn" && (a.stage ?? 0) < APP_STAGES.length - 1 && (
                            <button className="link small" onClick={() => moveApplicant(a, "advance")}>
                              Approve: {APP_STAGES[(a.stage ?? 0) + 1]}
                            </button>
                          )}
                          {a.status !== "withdrawn" && (a.stage ?? 0) <= 1 && (
                            <button className="link small" style={{ marginLeft: 12 }} onClick={() => moveApplicant(a, "reject")}>
                              Not eligible
                            </button>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {closed && a.status !== "withdrawn" && onRate && (
                            <button className="link small" onClick={() => onRate(a, study)}>
                              {a.rating ? `★ ${a.rating.stars}. Edit` : "Rate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="soft" style={{ textAlign: "center", padding: 36 }}>
                        No applications yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================= profile editor ================= */
/**
 * Paste a DOI, get a filled-in publication.
 *
 * The row is added already filled and still editable, so a lookup is a starting point
 * rather than something you have to accept. Everything can still be typed by hand:
 * Crossref does not have every paper, and a book chapter or a preprint may not be there
 * at all.
 */
function DoiAdd({ onAdd, known }) {
  const [doi, setDoi] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const go = async () => {
    setErr("");
    const already = known.includes(cleanDoi(doi));
    if (already) return setErr("That DOI is already in your list.");
    setBusy(true);
    try {
      const row = await lookupDoi(doi);
      onAdd(row);
      setDoi("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="doi-add">
      <Field label="Add by DOI">
        <div className="doi-row">
          <input
            value={doi}
            maxLength="200"
            placeholder="10.1038/s41586-020-2649-2"
            onChange={(e) => {
              setDoi(e.target.value);
              setErr("");
            }}
            // Enter would submit the whole profile form, which is not what this is for.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (doi.trim() && !busy) go();
              }
            }}
          />
          <button type="button" className="btn btn-blue" onClick={go} disabled={busy || !doi.trim()}>
            {busy ? "Looking up…" : "Look up"}
          </button>
        </div>
      </Field>
      {err ? (
        <p className="small doi-err">{err}</p>
      ) : (
        <p className="small soft">Or add one by hand below. A DOI link works too.</p>
      )}
    </div>
  );
}

export function ProfileEditor({ onVerify, onScholar, onRor, onDelete }) {
  const { backend, toast } = useUI();
  const [handleAuto, setHandleAuto] = useState(!AUTH.researcher?.handle);
  const [handle, setHandle] = useState(AUTH.researcher?.handle || "");
  const [inst, setInst] = useState({ name: AUTH.researcher?.institution || "", ror: AUTH.researcher?.ror || "" });
  const r0 = AUTH.researcher;
  // Paths, not a comma list. A profile saved before this change holds plain strings,
  // which read as one-step paths.
  const [interests, setInterests] = useState(() =>
    (r0?.interests || []).map((x) => (Array.isArray(x) ? [...x] : [x])).filter((x) => x.length)
  );
  const [discipline, setDiscipline] = useState(r0?.discipline || "");
  const [visibility, setVisibility] = useState(r0?.visibility || "private");
  const [pubs, setPubs] = useState(() => (r0?.publications || []).map((x) => ({ ...x, authorNames: x.authorNames?.length ? [...x.authorNames] : namesFromHarvard(x.authors) })));
  const [highlights, setHighlights] = useState(() => (r0?.highlights || []).map((x) => ({ ...x })));
  const [academic, setAcademic] = useState(() => (r0?.academicRoles || []).map((x) => ({ ...x })));
  const [research, setResearch] = useState(() => (r0?.researchRoles || []).map((x) => ({ ...x })));
  const [memberships, setMemberships] = useState(() => (r0?.memberships || []).map((x) => ({ ...x })));
  const [supervising, setSupervising] = useState(() => (r0?.supervising || []).map((x) => ({ ...x })));
  const [sup, setSup] = useState("");
  const yr = new Date().getFullYear();
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
        {!isNew && <IdCheckPanel returnTo="#/profile/edit" />}
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
              discipline,
              visibility,
              interests: interests.map((path) => path.map((x) => x.trim()).filter(Boolean)).filter((path) => path.length),
              publications: pubs.map((x) => ({
                title: x.title,
                authorNames: (x.authorNames || []).map((n) => n.trim()).filter(Boolean),
                venue: x.venue,
                year: Number(x.year) || 0,
                url: x.url || "",
                doi: x.doi || "",
                citations: x.citations == null ? null : Number(x.citations),
              })),
              highlights: highlights.map((x) => ({ title: x.title, detail: x.detail || "", year: x.year ? Number(x.year) : null })),
              academicRoles: academic.map((x) => ({ title: x.title, org: x.org || "", from: x.from ? Number(x.from) : null, to: x.to ? Number(x.to) : null })),
              researchRoles: research.map((x) => ({ title: x.title, org: x.org || "", from: x.from ? Number(x.from) : null, to: x.to ? Number(x.to) : null })),
              memberships: memberships.map((x) => ({ body: x.body, grade: x.grade || "", since: x.since ? Number(x.since) : null })),
              supervising: supervising.map((x) => ({ researcherId: x.researcherId, role: x.role || "PhD student" })),
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
              <div className="row2">
                <Field label="Discipline" hint={<div className="counter" style={{ textAlign: "left" }}>Groups you on the leaderboard and roots your interests</div>}>
                  <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
                    <option value="">Choose one</option>
                    {DISCIPLINES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Who can see your profile">
                  <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                    <option value="private">Signed-in researchers only</option>
                    <option value="public">Anyone — list it publicly</option>
                  </select>
                </Field>
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
            <h2>Research interests</h2>
            <p className="hint">
              Each one is a path narrowing down from your discipline, drawn as a tree on your profile:{" "}
              <strong>{discipline || "Technology"} → Human–computer interaction → Technostress</strong>. Paths that start the same way
              share a branch.
            </p>
            <Repeater
              rows={interests}
              setRows={setInterests}
              max={24}
              blank={["", ""]}
              noun={["Interest", "No interests added."]}
            >
              {(path, _set, i) => (
                <div className="ipath">
                  <span className="node node-root">{discipline || "Your discipline"}</span>
                  {path.concat("").slice(0, 4).map((step, j) => (
                    <span className="ipath-step" key={j}>
                      <span className="ipath-arrow" aria-hidden="true">→</span>
                      <input
                        aria-label={`Interest ${i + 1}, level ${j + 1}`}
                        maxLength="60"
                        value={step}
                        placeholder={j === 0 ? "Broad area" : "Narrower"}
                        onChange={(e) => {
                          const next = [...path];
                          next[j] = e.target.value;
                          setInterests(interests.map((x, k) => (k === i ? next.filter((v, n) => v || n < next.length - 1) : x)));
                        }}
                      />
                    </span>
                  ))}
                </div>
              )}
            </Repeater>
          </div>

          <div className="fsec">
            <h2>Publications</h2>
            <p className="hint">
              Paste a DOI and the rest fills itself in from Crossref. These earn your yearly points, so the year on each one matters.
              Listed newest first on your profile.
            </p>
            <DoiAdd
              onAdd={(row) => setPubs([row, ...pubs])}
              known={pubs.map((x) => x.doi).filter(Boolean)}
            />
            <Repeater rows={pubs} setRows={setPubs} max={300} blank={{ title: "", authorNames: [""], venue: "", year: "", url: "", doi: "", citations: null }} noun={["Publication", "No publications added."]}>
              {(x, set) => (
                <>
                  {x.doi && (
                    <p className="small soft doi-note">
                      <Icon.check /> From DOI <code>{x.doi}</code>
                      {typeof x.citations === "number" ? ` · ${plural(x.citations, "citation", "citations")} at the time of lookup` : ""}
                    </p>
                  )}
                  <Field label="Title" required>
                    <input required maxLength="300" value={x.title || ""} onChange={(e) => set("title", e.target.value)} />
                  </Field>
                  <div className="f field-stack">
                    <span className="req">Authors</span>
                    <AuthorNames names={x.authorNames?.length ? x.authorNames : [""]} onChange={(names) => set("authorNames", names)} />
                  </div>
                  <div className="row2">
                    <Field label="Journal or venue" required>
                      <input required maxLength="200" value={x.venue || ""} onChange={(e) => set("venue", e.target.value)} />
                    </Field>
                    <Field label="Year" required>
                      <input type="number" required min="1900" max={yr + 1} value={x.year || ""} onChange={(e) => set("year", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Link">
                    <input type="url" value={x.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://doi.org/…" />
                  </Field>
                </>
              )}
            </Repeater>
          </div>

          <div className="fsec">
            <h2>Highlights</h2>
            <p className="hint">Awards, grants, keynotes — anything worth pulling out of the list.</p>
            <Repeater rows={highlights} setRows={setHighlights} max={8} blank={{ title: "", detail: "", year: "" }} noun={["Highlight", "No highlights added."]}>
              {(x, set) => (
                <>
                  <div className="row2">
                    <Field label="What it was" required>
                      <input required maxLength="160" value={x.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Best paper award, CHI" />
                    </Field>
                    <Field label="Year">
                      <input type="number" min="1900" max={yr + 1} value={x.year || ""} onChange={(e) => set("year", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="A line about it">
                    <input maxLength="400" value={x.detail || ""} onChange={(e) => set("detail", e.target.value)} />
                  </Field>
                </>
              )}
            </Repeater>
          </div>

          <div className="fsec">
            <h2>Academic roles</h2>
            <p className="hint">Posts you have held. Leave the end year empty for the one you hold now.</p>
            <Repeater rows={academic} setRows={setAcademic} max={20} blank={{ title: "", org: "", from: "", to: "" }} noun={["Academic role", "No academic roles added."]}>
              {(x, set) => (
                <>
                  <div className="row2">
                    <Field label="Title" required>
                      <input required maxLength="160" value={x.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Senior lecturer" />
                    </Field>
                    <Field label="Institution">
                      <input maxLength="160" value={x.org || ""} onChange={(e) => set("org", e.target.value)} />
                    </Field>
                  </div>
                  <YearSpan row={x} set={set} year={yr} />
                </>
              )}
            </Repeater>
          </div>

          <div className="fsec">
            <h2>Research roles</h2>
            <p className="hint">Editorial and review work: Editor-in-Chief, Associate Editor, programme committees, grant panels.</p>
            <Repeater rows={research} setRows={setResearch} max={20} blank={{ title: "", org: "", from: "", to: "" }} noun={["Research role", "No research roles added."]}>
              {(x, set) => (
                <>
                  <div className="row2">
                    <Field label="Role" required>
                      <input required maxLength="160" value={x.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Associate Editor" />
                    </Field>
                    <Field label="Journal or body">
                      <input maxLength="200" value={x.org || ""} onChange={(e) => set("org", e.target.value)} />
                    </Field>
                  </div>
                  <YearSpan row={x} set={set} year={yr} />
                </>
              )}
            </Repeater>
          </div>

          <div className="fsec">
            <h2>Supervision</h2>
            <p className="hint">
              Researchers you supervise. They need a HumAIn Labs profile first; their page will show you as their supervisor.
            </p>
            <div className="stack">
              {supervising.map((x, i) => {
                const who = byId("researchers", x.researcherId);
                if (!who) return null;
                return (
                  <div className="mrow" key={x.researcherId}>
                    <Avatar name={who.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{who.name}</strong>
                      <div className="small soft">{who.institution}</div>
                    </div>
                    <input
                      aria-label={`What ${who.name} is to you`}
                      maxLength="80"
                      value={x.role || ""}
                      placeholder="PhD student"
                      onChange={(e) => setSupervising(supervising.map((y, j) => (j === i ? { ...y, role: e.target.value } : y)))}
                    />
                    <button type="button" className="link small" onClick={() => setSupervising(supervising.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </div>
                );
              })}
              {!supervising.length && <p className="rep-empty">Nobody added yet.</p>}
              <Field label="Add a researcher">
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id && !supervising.some((y) => y.researcherId === id)) setSupervising([...supervising, { researcherId: id, role: "PhD student" }]);
                    setSup("");
                  }}
                >
                  <option value="">Choose a registered researcher</option>
                  {S.researchers
                    .filter((o) => o.id !== r0?.id && !supervising.some((y) => y.researcherId === o.id))
                    .sort(sortByName)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} — {o.institution}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="fsec">
            <h2>Professional memberships</h2>
            <Repeater rows={memberships} setRows={setMemberships} max={20} blank={{ body: "", grade: "", since: "" }} noun={["Membership", "No memberships added."]}>
              {(x, set) => (
                <>
                  <Field label="Body" required>
                    <input required maxLength="200" value={x.body || ""} onChange={(e) => set("body", e.target.value)} placeholder="British Psychological Society" />
                  </Field>
                  <div className="row2">
                    <Field label="Grade">
                      <input maxLength="80" value={x.grade || ""} onChange={(e) => set("grade", e.target.value)} placeholder="Fellow" />
                    </Field>
                    <Field label="Member since">
                      <input type="number" min="1900" max={yr + 1} value={x.since || ""} onChange={(e) => set("since", e.target.value)} />
                    </Field>
                  </div>
                </>
              )}
            </Repeater>
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
            {!isNew && (
              <>
                <span className="spacer" />
                <button type="button" className="btn btn-danger" onClick={onDelete}>
                  Delete profile
                </button>
              </>
            )}
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

  // Unverified researchers can look at groups but not create or change them.
  if (!me)
    return (
      <div className="wrap">
        <SignInPrompt title="Research groups" text="Sign in with your researcher account to create or edit a research group." />
      </div>
    );
  if (me && !(me.verified && me.idVerified))
    return (
      <div className="wrap">
        <a className="back" href={editing ? groupHref(g) : "#/dashboard"}>
          ← {editing ? g.name : "Researcher area"}
        </a>
        <div className="empty" style={{ marginTop: 16 }}>
          <div>View-only mode. Verify your institution email and identity to create or edit research groups.</div>
          <a className="btn btn-blue" href="#/dashboard">
            Go to your researcher area
          </a>
        </div>
      </div>
    );

  const ownerId = editing ? g.ownerId : me.id;
  const isLead = !editing || g.ownerId === me.id || (g.members || []).some((m) => m.researcherId === me.id && /lead/i.test(m.role || ""));
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
              visibility: d.visibility === "public" ? "public" : "private",
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

            <div className="fsec">
              <h2>Visibility</h2>
              <p className="hint">
                {isLead ? "Choose who can find this group page." : "Only the group lead can change this setting."}
              </p>
              <div className="radio-row">
                <label className="check">
                  <input type="radio" name="visibility" value="public" defaultChecked={v.visibility === "public"} disabled={!isLead} /> Public: anyone can
                  see it, signed in or not
                </label>
                <label className="check">
                  <input type="radio" name="visibility" value="private" defaultChecked={v.visibility !== "public"} disabled={!isLead} /> Private: only
                  signed-in researchers can see it
                </label>
              </div>
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

// Home, Studies, Reach, My applications, About and the sign-in / register page.
import { useEffect, useRef, useState } from "react";
import { Cover, DeadlinePill, HomeBackdrop, Icon, Spark, TrendChips, VerifiedBadge } from "../components/ui.jsx";
import { StudyAction, StudyCard, Toolbar, studyTrend } from "../components/cards.jsx";
import { AUTH, S, byId, role, studyGroupName, studyVerified } from "../lib/store.js";
import { countryInfo, fmtDate, isOpen, matches, plural, uniq } from "../lib/util.js";
import { Field, Form, SubmitButton, navigate, reducedMotion, replaceRoute, useUI } from "../lib/ui.jsx";
import founderPhoto from "../data/founder.jpg";

// Participants only ever see open studies from verified researchers.
export const isVisible = (s) => !s.hidden && !!studyVerified(s) && isOpen(s);
export const visibleStudies = () => S.studies.filter(isVisible);
export const trending = (n = 5) =>
  visibleStudies()
    .map((s) => ({ s, t: studyTrend(s) }))
    .sort((a, b) => b.t.score - a.t.score || String(b.s.postedAt).localeCompare(String(a.s.postedAt)))
    .slice(0, n);

/* ================= home ================= */
const TREND_MS = 7000;

export function Home({ onApply, setStudyQuery }) {
  const top = trending(5);
  const n = visibleStudies().length;
  const fields = uniq(visibleStudies().map((s) => s.field)).length;
  const [spot, setSpot] = useState(0);
  const [paused, setPaused] = useState(false);
  const idx = Math.min(spot, Math.max(0, top.length - 1));

  useEffect(() => {
    if (paused || reducedMotion() || top.length < 2) return;
    const t = setInterval(() => setSpot((i) => (i + 1) % top.length), TREND_MS);
    return () => clearInterval(t);
  }, [paused, top.length, idx]);

  const search = (e) => {
    e.preventDefault();
    setStudyQuery(new FormData(e.target).get("q").toString().trim());
    navigate("#/studies");
  };

  return (
    <>
      <section className="home-hero">
        <HomeBackdrop />
        <div className="home-inner">
          <h1 className="tagline">
            Research needs <em>people</em>.
            <br />
            We’re building the place they meet.
          </h1>
          <form className="hsearch" role="search" onSubmit={search}>
            <label className="sr-only" htmlFor="hq">
              Search studies
            </label>
            <input id="hq" name="q" autoComplete="off" placeholder="Search studies: sleep, AI, families…" />
            <button className="hbtn solid" type="submit">
              Search
            </button>
          </form>
          <p className="hmeta">
            {plural(n, "open study", "open studies")} across {plural(fields, "field", "fields")}, every one from a verified researcher
          </p>
        </div>
      </section>
      <div className="wrap">
        <section
          className={"home-sec trend" + (paused || reducedMotion() ? " paused" : "")}
          id="trend"
          aria-label="Trending studies"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="intro">
            <div>
              <p className="eyebrow">
                <span className="pulse" aria-hidden="true" />
                Updated as people apply
              </p>
              <h2 className="h2big">Trending studies</h2>
              <p className="soft">Ranked by how many people have applied recently. New studies get a head start.</p>
            </div>
            <a className="btn btn-blue" href="#/studies">
              See all {n} studies
            </a>
          </div>
          {top.length ? (
            <div className="trend-body">
              <div className="spot" id="spot" aria-live="polite">
                <Spotlight entry={top[idx]} rank={idx + 1} onApply={onApply} />
              </div>
              <ol className="rank" id="rank">
                {top.map(({ s: x, t: tx }, i) => (
                  <li key={x.id}>
                    <button type="button" className={"ritem" + (i === idx ? " active" : "")} aria-pressed={i === idx} onClick={() => setSpot(i)}>
                      <span className="rnum">{String(i + 1).padStart(2, "0")}</span>
                      <span className="rbody">
                        <span className="rtitle">{x.title}</span>
                        <span className="rsub">
                          {x.field}, {x.format || "Online"}
                        </span>
                      </span>
                      <span className="rside">
                        <Spark vals={tx.weekly} />
                        <span className="rchips">
                          <TrendChips t={tx} />
                        </span>
                      </span>
                      <span className="rprog" aria-hidden="true">
                        <i style={{ animationDuration: `${TREND_MS}ms` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="empty">
              <div>No studies posted yet.</div>
            </div>
          )}
        </section>
        <section className="home-sec trust">
          <div>
            <span className="tnum">
              <Icon.check />
            </span>
            <h3>Only verified researchers</h3>
            <p className="soft small">
              Researchers confirm an email address at their institution before they can post a study, and the badge shows on every study.
            </p>
          </div>
          <div>
            <span className="tnum">
              <Icon.mail />
            </span>
            <h3>Your details go to one person</h3>
            <p className="soft small">When you apply, only the researcher running that study sees your details, and they contact you directly.</p>
          </div>
          <div>
            <span className="tnum">
              <Icon.inst />
            </span>
            <h3>Separate spaces</h3>
            <p className="soft small">
              Participants and researchers have their own accounts and their own views, so each side sees what's relevant to them.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function Spotlight({ entry: { s, t }, rank, onApply }) {
  return (
    <article className="spot-card" data-id={s.id}>
      <div className="spot-art">
        <Cover seed={s.id + "-spot"} label={s.field} />
        <span className="spot-rank">#{rank} trending</span>
        <span className="chip spot-field">{s.field}</span>
      </div>
      <div className="spot-body">
        <div className="badges">
          <DeadlinePill study={s} />
          <VerifiedBadge v={studyVerified(s)} withDomain={false} />
          <TrendChips t={t} />
        </div>
        <h3>{s.title}</h3>
        <div className="small soft">
          {s.researcherName}, {s.institution}
          {studyGroupName(s) ? ` · ${studyGroupName(s)}` : ""}
        </div>
        <p className="small">{s.description}</p>
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
        {s.criteria && <div className="elig">Who can take part: {s.criteria}</div>}
        <div className="spark-box">
          <div className="small soft">Interest over the last 8 weeks</div>
          <Spark vals={t.weekly} w={320} h={64} area className="spark spark-lg" />
        </div>
        <div className="spot-act">
          <StudyAction study={s} full={false} onApply={onApply} solid />
        </div>
      </div>
    </article>
  );
}

/* ================= studies ================= */
export function Studies({ filters, setFilters, onApply }) {
  const f = filters;
  const list = visibleStudies()
    .filter(
      (s) =>
        matches(f.q, [s.title, s.description, s.criteria, s.researcherName, s.institution, s.field, s.country]) &&
        (!f.field || s.field === f.field) &&
        (!f.country || s.country === f.country) &&
        (!f.format || s.format === f.format)
    )
    .sort(
      f.sort === "Closing soon"
        ? (a, b) => String(a.closesAt || "9999").localeCompare(String(b.closesAt || "9999"))
        : f.sort === "Trending"
        ? (a, b) => studyTrend(b).score - studyTrend(a).score
        : (a, b) => String(b.postedAt).localeCompare(String(a.postedAt))
    );
  return (
    <div className="wrap">
      <section className="band">
        <div className="txt">
          <span className="badge" style={{ width: "fit-content" }}>
            {plural(visibleStudies().length, "open call", "open calls")} from verified researchers
          </span>
          <h1>Take part in research that matters</h1>
          <p className="soft">Researchers post a short call here. Find one that fits, apply with the basics, and they'll get in touch directly.</p>
        </div>
        <div className="art">
          <Cover seed="hero-studies" label="x" />
        </div>
      </section>
      <Toolbar
        page="studies"
        filters={filters}
        setFilters={setFilters}
        hint="Search studies"
        noun={["study", "studies"]}
        count={list.length}
        total={visibleStudies().length}
        defs={[
          ["field", "All fields", uniq(visibleStudies().map((s) => s.field))],
          ["country", "All countries", uniq(visibleStudies().map((s) => s.country))],
          ["format", "Any format", ["Online", "In person", "Hybrid"]],
          ["sort", "Newest first", ["Closing soon", "Trending"]],
        ]}
      >
        {list.map((s) => (
          <StudyCard key={s.id} study={s} onApply={onApply} />
        ))}
      </Toolbar>
    </div>
  );
}

/* ================= global reach ================= */
export function Reach({ dark }) {
  const list = Object.entries(S.stats.byCountry || {}).sort((a, b) => b[1] - a[1]);
  const max = list[0]?.[1] || 1;
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fail = () => {
      el.innerHTML = '<div class="loading">The map couldn\'t load. The country list below still shows where participants are.</div>';
    };
    if (typeof window.jsVectorMap !== "function") return fail();
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const pts = Object.entries(S.stats.byCountry || {})
      .map(([c, n]) => ({ ...countryInfo(c), n }))
      .filter((p) => p.iso);
    const regions = {};
    pts.forEach((p) => (regions[p.iso] = "hit"));
    let map = null;
    try {
      map = new window.jsVectorMap({
        selector: el,
        map: "world",
        zoomOnScroll: false,
        zoomButtons: true,
        backgroundColor: "transparent",
        regionStyle: { initial: { fill: v("--map-land"), stroke: v("--paper-2"), strokeWidth: 0.4 }, hover: { fillOpacity: 0.85, cursor: "default" } },
        series: { regions: [{ attribute: "fill", scale: { hit: v("--map-hit") }, values: regions }] },
        markers: pts.map((p) => ({ name: `${p.name}: ${plural(p.n, "participant", "participants")}`, coords: [p.lat, p.lng], style: { initial: { r: 4 + Math.sqrt(p.n) * 2.2 } } })),
        markerStyle: {
          initial: { fill: v("--blue"), stroke: v("--card"), strokeWidth: 2, strokeOpacity: 1, fillOpacity: 0.95 },
          hover: { fill: v("--blue-deep"), cursor: "pointer" },
        },
      });
    } catch (e) {
      fail();
    }
    return () => {
      try {
        map?.destroy();
      } catch (e) {}
      el.innerHTML = "";
    };
  }, [dark, S.stats]);

  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>Global reach</h1>
          <p className="soft">Where participants who have applied through HumAIn Labs are based. Hover a marker for the count.</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <b>{S.stats.total || 0}</b>
          <span className="small soft">participant applications</span>
        </div>
        <div className="stat">
          <b>{list.length}</b>
          <span className="small soft">countries</span>
        </div>
        <div className="stat">
          <b>{S.studies.length}</b>
          <span className="small soft">open studies</span>
        </div>
      </div>
      <div className="mapbox">
        <div id="map" ref={box} />
      </div>
      <div className="bars">
        {list.slice(0, 8).map(([c, n]) => (
          <div className="bar" key={c}>
            <span>{c}</span>
            <i style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
            <span className="soft">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= my applications ================= */
export function MyApplications() {
  if (role() === "researcher") {
    navigate("#/dashboard");
    return null;
  }
  if (!AUTH.user)
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>My applications</h1>
          </div>
        </div>
        <div className="empty">
          <div>Sign in to see the studies you've applied to.</div>
          <a className="btn btn-blue" href="#/auth?mode=signin&as=participant">
            Sign in
          </a>
        </div>
      </div>
    );
  const cards = [...S.myApps]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((a) => ({ a, s: byId("studies", a.studyId) }))
    .filter((x) => x.s);
  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>My applications</h1>
          <p className="soft">Studies you've applied to.</p>
        </div>
      </div>
      {cards.length ? (
        <div className="grid">
          {cards.map(({ a, s }) => (
            <article className="card" key={a.id}>
              <div className="cover">
                <Cover seed={s.id} label={s.field} />
                <span className="chip">{s.field}</span>
              </div>
              <div className="body">
                <h3>{s.title}</h3>
                <div className="small soft">
                  {s.researcherName}, {s.institution}
                </div>
                <div className="small soft grow">Applied {fmtDate(a.date)}</div>
                <div className="foot">
                  <span className="small">The researcher will contact you at {a.email}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <div>You haven't applied to any studies yet.</div>
          <a className="btn btn-blue" href="#/studies">
            Browse open studies
          </a>
        </div>
      )}
    </div>
  );
}

/* ================= about ================= */
// Edit these to change the About page. The photo is bundled into the page at build time.
const CONTACT_EMAIL = "partners@humain.example"; // ← change to your real address
const FOUNDERS = [
  {
    name: "Dr Sasan Radan",
    role: "Founder",
    based: "",
    photo: founderPhoto,
    bio: "Started HumAIn to make it easier for research to reach the people it's about, and for researchers to find each other.",
    linkedin: "", // ← paste the LinkedIn profile URL here
  },
];
const PARTNERS = [
  { name: "Partner name", kind: "University or research institute", note: "A line about what you work on together." },
  { name: "Partner name", kind: "Funder or industry partner", note: "A line about what you work on together." },
  { name: "Partner name", kind: "Participant community or charity", note: "A line about what you work on together." },
];

export function About() {
  return (
    <div className="wrap about">
      <section className="about-hero">
        <p className="eyebrow">About HumAIn Labs</p>
        <h1>Research needs people. We’re building the place they meet.</h1>
        <p className="lead soft">
          Most studies struggle to find the right participants, and most people never hear about the research they could take part in. HumAIn Labs puts
          open studies, verified researchers and research groups in one place, so both sides can find each other without cold emails and noticeboards.
        </p>
      </section>

      <section className="home-sec">
        <h2 className="h2big">What we do</h2>
        <div className="trust" style={{ marginTop: 16 }}>
          <div>
            <span className="tnum">
              <Icon.check />
            </span>
            <h3>Verify researchers</h3>
            <p className="soft small">
              Every researcher confirms an email address at their institution before they can post a study, so participants know who they're dealing
              with.
            </p>
          </div>
          <div>
            <span className="tnum">
              <Icon.inst />
            </span>
            <h3>Give groups a home</h3>
            <p className="soft small">
              Research groups get a page with their people, publications and the roles they're hiring for, whether that's a PhD student or a
              collaborator.
            </p>
          </div>
          <div>
            <span className="tnum">
              <Icon.mail />
            </span>
            <h3>Keep it direct</h3>
            <p className="soft small">Applications go straight to the researcher running the study, and nobody else sees them.</p>
          </div>
        </div>
      </section>

      <section className="home-sec">
        <h2 className="h2big">Founders</h2>
        <p className="soft" style={{ maxWidth: "66ch", marginTop: 8 }}>
          HumAIn Labs is built by people who have been on both sides of a study: waiting on recruitment that stalls, and hearing about research only
          once it has finished. The team is small, so you can reach us directly.
        </p>
        <div className="grid people-grid" style={{ marginTop: 20 }}>
          {FOUNDERS.map((f) => (
            <article className="card" key={f.name}>
              <div className="body">
                <div className="person">
                  <img className="headshot" src={f.photo} alt={f.name} width="56" height="56" />
                  <div style={{ minWidth: 0 }}>
                    <h3>{f.name}</h3>
                    <div className="small" style={{ color: "var(--blue)" }}>
                      {f.role}
                    </div>
                  </div>
                </div>
                {f.based && (
                  <div className="small soft" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                    <Icon.globe /> {f.based}
                  </div>
                )}
                <p className="small grow" style={{ marginTop: 8 }}>
                  {f.bio}
                </p>
                {f.linkedin && (
                  <div className="foot">
                    <div className="btns">
                      <a className="btn btn-blue" href={f.linkedin} target="_blank" rel="noopener">
                        <Icon.linkedin /> LinkedIn
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-sec">
        <div className="intro">
          <div>
            <h2 className="h2big">Partners</h2>
            <p className="soft">Institutions, funders and communities we work with.</p>
          </div>
        </div>
        <div className="partners">
          {PARTNERS.map((x, i) => (
            <div className="partner" key={i}>
              <span className="partner-mark" aria-hidden="true">
                {x.name.trim().slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="pname">{x.name}</div>
                <div className="small soft">{x.kind}</div>
                {x.note && (
                  <p className="small soft" style={{ marginTop: 6 }}>
                    {x.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-sec about-cta">
        <h2>Want to work with us?</h2>
        <p className="soft">
          If your institution, funder or community would like to partner with HumAIn Labs, tell us what you have in mind and we'll take it from there.
        </p>
        <div className="actions">
          <a className="btn btn-solid" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Becoming a HumAIn Labs partner")}`}>
            <Icon.mail /> Contact us about partnering
          </a>
        </div>
      </section>
    </div>
  );
}

/* ================= sign in and register ================= */
const AUTH_COPY = {
  participant: {
    title: "Take part in research",
    steps: [
      ["Find a study", "Browse open studies from verified researchers, filtered by field, country and format."],
      ["Apply in a minute", "Send your name, age and country, plus anything the researcher should know."],
      ["Hear back directly", "Only the researcher running that study sees your details, and they contact you themselves."],
    ],
  },
  researcher: {
    title: "Recruit and collaborate",
    steps: [
      ["Create a verified profile", "Add your institution, field, LinkedIn and ORCID, then confirm your institution email for the Verified badge. Only verified researchers can post studies."],
      ["Build your research group", "Add members by @-mentioning other registered researchers, list your publications, and share openings for PhD students and collaborators."],
      ["Recruit participants", "Post a study with a closing date, and applications land in your researcher area. Only you can see who applied."],
    ],
  },
};

export function Auth({ route, afterAuth, setAfterAuth }) {
  const { backend, toast } = useUI();
  const mode = route.q.get("mode") === "register" ? "register" : "signin";
  const as = route.q.get("as") === "researcher" ? "researcher" : "participant";
  const switchTo = (key, val) => {
    const q = route.q;
    q.set(key, val);
    replaceRoute("#/auth?" + q.toString());
  };
  const Seg = ({ k, val, label, cur }) => (
    <button type="button" className="seg-btn" role="tab" aria-selected={val === cur} onClick={() => switchTo(k, val)}>
      {label}
    </button>
  );

  if (AUTH.user)
    return (
      <div className="wrap">
        <div className="auth-shell">
          <div className="auth-card">
            <h1 style={{ fontSize: "1.6rem" }}>You're signed in</h1>
            <p className="soft" style={{ margin: "8px 0 18px" }}>
              Signed in as <strong>{AUTH.researcher?.name || AUTH.user.name}</strong> with a {role()} account.
            </p>
            <div className="actions">
              <a className="btn btn-solid" href={role() === "researcher" ? "#/dashboard" : "#/studies"}>
                {role() === "researcher" ? "Go to researcher area" : "Browse open studies"}
              </a>
              <button className="btn" onClick={() => backend.signOut()}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  const c = AUTH_COPY[as];
  let form;
  if (backend.kind === "azure") {
    const target =
      as === "researcher"
        ? mode === "register"
          ? "#/profile"
          : "#/dashboard"
        : afterAuth?.hash && afterAuth.hash !== "#/"
        ? afterAuth.hash
        : "#/studies";
    const back = encodeURIComponent("/" + target);
    form = (
      <>
        <p className="soft small">
          {mode === "register"
            ? "Registering uses your existing Microsoft or GitHub account, so there's no new password to remember."
            : "Sign in with the account you registered with."}
        </p>
        <a className="btn provider" href={`/.auth/login/aad?post_login_redirect_uri=${back}`}>
          <Icon.ms /> {mode === "register" ? "Register" : "Sign in"} with Microsoft
        </a>
        <a className="btn provider" href={`/.auth/login/github?post_login_redirect_uri=${back}`}>
          <Icon.gh /> {mode === "register" ? "Register" : "Sign in"} with GitHub
        </a>
        {as === "researcher" && mode === "register" && (
          <p className="small soft" style={{ marginTop: 14 }}>
            Next you'll set up your researcher profile and verify your institution email.
          </p>
        )}
      </>
    );
  } else {
    form = (
      <Form
        id="auth-form"
        className="stack"
        onSubmit={(d) => {
          const email = d.email.toLowerCase();
          const existing = S.researchers.find((x) => (x.userId || "").toLowerCase() === "demo:" + email);
          const name = d.name || existing?.name || email.split("@")[0];
          backend.demoSignIn(name, email);
          const after = afterAuth;
          setAfterAuth(null);
          if (as === "researcher") {
            toast(AUTH.researcher ? `Signed in as ${AUTH.researcher.name}.` : "Now set up your researcher profile.");
            navigate(AUTH.researcher ? "#/dashboard" : "#/profile");
            return;
          }
          toast(
            AUTH.researcher
              ? "This email has a researcher profile, so you're in the researcher view."
              : mode === "register"
              ? "Account created. You can apply to studies now."
              : "Signed in."
          );
          navigate(after?.hash && after.hash !== "#/" && after.hash !== "#" ? after.hash : AUTH.researcher ? "#/dashboard" : "#/studies");
          if (after?.then && !AUTH.researcher) setTimeout(after.then, 50);
        }}
      >
        {mode === "register" && (
          <Field label="Full name">
            <input name="name" required autoComplete="name" />
          </Field>
        )}
        <Field label={as === "researcher" ? "Email you use for research" : "Email"}>
          <input name="email" type="email" required autoComplete="email" />
        </Field>
        <SubmitButton>
          {mode === "register" ? (as === "researcher" ? "Register and set up profile" : "Create participant account") : "Sign in"}
        </SubmitButton>
        <div className="demo-hint" style={{ marginTop: 0 }}>
          Preview: no password needed. On the Azure version this uses Microsoft or GitHub sign-in.{" "}
          {as === "researcher" && mode === "signin" && (
            <>
              Try <strong>r.mehta@example.edu</strong> to use an existing researcher profile.
            </>
          )}
        </div>
      </Form>
    );
  }

  return (
    <div className="wrap">
      <div className="auth-shell">
        <aside className="auth-side">
          <p className="eyebrow" style={{ color: "#93A5FF" }}>
            {as === "researcher" ? "For researchers" : "For participants"}
          </p>
          <h2>{c.title}</h2>
          <ol className="auth-steps">
            {c.steps.map(([t, d], i) => (
              <li key={t}>
                <span className="stepn">{i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
        <div className="auth-card">
          <div className="seg" role="tablist" aria-label="Account type">
            <Seg k="as" val="participant" label="Participant" cur={as} />
            <Seg k="as" val="researcher" label="Researcher" cur={as} />
          </div>
          <h1 className="auth-title">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
          <div className="tabs" role="tablist" aria-label="Sign in or register">
            <Seg k="mode" val="signin" label="Sign in" cur={mode} />
            <Seg k="mode" val="register" label="Register" cur={mode} />
          </div>
          {form}
          <p className="small soft auth-switch">
            {mode === "register" ? (
              <>
                Already registered?{" "}
                <button className="link" onClick={() => switchTo("mode", "signin")}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to HumAIn Labs?{" "}
                <button className="link" onClick={() => switchTo("mode", "register")}>
                  Register
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= gates ================= */
export function ResearcherGate({ title }) {
  if (role() === "participant")
    return (
      <div className="wrap">
        <div className="intro">
          <div>
            <h1>{title}</h1>
          </div>
        </div>
        <div className="setup">
          <h2>This part of HumAIn Labs is for researchers</h2>
          <p className="soft">
            You're signed in with a participant account. Researchers use a separate account with a researcher profile, so your applications stay
            separate from any research you run.
          </p>
          <div className="actions">
            <a className="btn btn-solid" href="#/studies">
              Back to open studies
            </a>
            <a className="btn" href="#/profile">
              Set up a researcher profile on this account
            </a>
          </div>
        </div>
      </div>
    );
  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="setup">
        <h2>This part of HumAIn Labs is for researchers</h2>
        <p className="soft">Sign in with your researcher account to see the researcher directory, research groups and recruitment numbers.</p>
        <div className="actions">
          <a className="btn btn-solid" href="#/auth?mode=signin&as=researcher">
            Researcher sign in
          </a>
          <a className="btn" href="#/auth?mode=register&as=researcher">
            Register as a researcher
          </a>
        </div>
      </div>
    </div>
  );
}

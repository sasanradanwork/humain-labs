// Home, Studies, Reach, My applications, About and the sign-in / register page.
import { useEffect, useRef, useState } from "react";
import { Cover, DeadlinePill, HomeBackdrop, Icon, Spark, TrendChips, VerifiedBadge } from "../components/ui.jsx";
import { StudyAction, StudyCard, Toolbar, studyTrend, ApplicationStages } from "../components/cards.jsx";
import { AUTH, S, appCount, byId, role, studyGroupName, studyVerified } from "../lib/store.js";
import { countryInfo, fmtDate, isOpen, matches, plural, today, uniq } from "../lib/util.js";
import { HlgBadge } from "../components/hlg.jsx";
import { Field, Form, SubmitButton, navigate, reducedMotion, replaceRoute, useRoute, useUI } from "../lib/ui.jsx";
import { SITE } from "../lib/site.js";
import { gbp } from "../lib/money.js";
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
            <span className="tnum ok">
              <Icon.check />
            </span>
            <h3>Only verified researchers</h3>
            <p className="soft small">
              Researchers confirm an email address at their institution before they can post a study, and the badge shows on every study.
            </p>
          </div>
          <div>
            <span className="tnum warm">
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
        <HowItWorks />
      </div>
    </>
  );
}

// How it works: the two sides, and how the money moves. Shown at the foot of the homepage.
const PARTICIPANT_STEPS = [
  ["Explore open studies", "Browse studies from verified researchers and find the ones you're interested in."],
  ["Check eligibility and apply", "Read who each study is for, then apply with the details you saved once."],
  ["Get invited", "If you're eligible, the researcher invites you to take part."],
];
const RESEARCHER_STEPS = [
  ["Advertise your study", "Post it with its budget, the reward for each participant and a closing date."],
  ["Check applications", "Review who has applied against your criteria."],
  ["Confirm eligibility", "Within your window, reach out to applicants and confirm they're eligible on HumAIn Labs."],
  ["Run the study", "Give confirmed participants the details, then complete the study with them."],
];

// The money flow, one step at a time. Each step can be selected to read what happens there.
const FLOW_STEPS = [
  {
    t: "Researcher funds the study",
    d: "The researcher pays the study budget to HumAIn Labs before the study opens.",
    c: "var(--blue)", tint: "var(--blue-tint)",
    icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  },
  {
    t: "We hold the funds",
    d: "The money stays with us until the study is complete. It is not released early.",
    c: "var(--t1f)", tint: "var(--t1b)",
    icon: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  },
  {
    t: "Participants are paid",
    d: "Each participant is paid their reward once they complete the study, whatever rating they receive.",
    c: "var(--green)", tint: "var(--green-tint)",
    icon: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  },
  {
    t: "Platform fee kept",
    d: "HumAIn Labs keeps a fee from each study to run the platform.",
    c: "var(--amber)", tint: "var(--amber-tint)",
    icon: <><path d="M6 18L18 6" /><circle cx="7.5" cy="7.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>,
  },
];

function MoneyFlow() {
  const [active, setActive] = useState(0);
  return (
    <ol className="flow-v" aria-label="How the money moves">
      {FLOW_STEPS.map((step, i) => {
        const open = active === i;
        return (
          <li key={step.t} className="flow-step">
            <button
              type="button"
              className="flow-btn"
              style={{ "--c": step.c, "--tint": step.tint }}
              aria-expanded={open}
              aria-controls={`flow-panel-${i}`}
              onClick={() => setActive(i)}
            >
              <span className="flow-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {step.icon}
                </svg>
              </span>
              <span>
                <span className="small soft">Step {i + 1}</span>
                <span className="flow-title" style={{ display: "block" }}>{step.t}</span>
              </span>
              <span className="flow-chev" aria-hidden="true">▾</span>
            </button>
            {open && <p className="flow-panel" id={`flow-panel-${i}`}>{step.d}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function HowItWorks() {
  return (
    <section className="home-sec how" aria-labelledby="how-title">
      <h2 className="h2big" id="how-title">How it works</h2>
      <p className="soft" style={{ maxWidth: "66ch", marginTop: 8 }}>
        HumAIn Labs sits between researchers and participants. Researchers post the study and fund
        it, and we hold the money until the work is done.
      </p>
      <div className="how-lanes" style={{ marginTop: 20 }}>
        <div className="how-lane">
          <h3>For participants</h3>
          <ol className="how-steps">
            {PARTICIPANT_STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="how-num">{i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <span className="small soft">{d}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="how-lane">
          <h3>For researchers</h3>
          <ol className="how-steps">
            {RESEARCHER_STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="how-num">{i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <span className="small soft">{d}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="how-money">
        <h3 style={{ margin: 0 }}>How the money moves</h3>
        <p className="small soft" style={{ marginTop: 6 }}>
          The researcher funds the study up front. We hold the money and pay each participant once they complete it.
        </p>
        <MoneyFlow />
        <div className="rating-note">
          <Icon.check />
          <p className="small soft" style={{ margin: 0 }}>
            Participants are paid their reward whatever their rating. After each study, the researcher rates the participant out of 5 for the quality of
            their work. Over time, a participant who consistently gives good data builds a strong rating, which helps them stand out to researchers, while
            a lower rating reflects work that didn't meet the researcher's standard.
          </p>
        </div>
      </div>
    </section>
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
// A researcher's own studies, listed above the open calls so they can manage them from here.
function MyStudies({ onNewStudy, onVerify }) {
  const me = AUTH.researcher;
  if (!me) return null;
  const mine = S.studies
    .filter((x) => x.researcherId === me.id)
    .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)));
  return (
    <section className="dash-sec">
      <div className="intro">
        <div>
          <h2>Your studies</h2>
          <p className="soft small">Open one to see who has applied, edit it or take it down.</p>
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
      {mine.length ? (
        <div className="list">
          {mine.map((x) => (
            <div className="item" key={x.id}>
              <div>
                <h3>
                  <a href={`#/studies/${encodeURIComponent(x.id)}`}>{x.title}</a>
                </h3>
                <div className="small soft">
                  Posted {fmtDate(x.postedAt)}, {plural(appCount(x.id), "applicant", "applicants")}
                  {x.participantsWanted ? `, ${x.participantsWanted} wanted at ${gbp(x.rewardEach)} each` : ""}
                </div>
                <div className="badges" style={{ marginTop: 6 }}>
                  <DeadlinePill study={x} />
                  {!isOpen(x) ? (
                    <span className="unverified">Closed to new applicants</span>
                  ) : !isVisible(x) ? (
                    <span className="unverified">Hidden from participants until you verify</span>
                  ) : null}
                </div>
              </div>
              <div className="btns">
                <a className="btn btn-blue" href={`#/studies/${encodeURIComponent(x.id)}`}>
                  Manage
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ padding: 30 }}>
          <div>You haven't posted any studies yet.</div>
        </div>
      )}
    </section>
  );
}

export function Studies({ filters, setFilters, onApply, onNewStudy, onVerify }) {
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
      <MyStudies onNewStudy={onNewStudy} onVerify={onVerify} />
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
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const pCountries = S.stats.participantsByCountry || S.stats.byCountry || {};
  const rCountries = S.stats.researchersByCountry || {};
  const list = Object.entries(pCountries).sort((a, b) => b[1] - a[1]);
  const max = list[0]?.[1] || 1;
  // Countries with either participants or researchers, largest first, shown side by side.
  const countries = [...new Set([...Object.keys(pCountries), ...Object.keys(rCountries)])]
    .map((c) => ({ c, p: pCountries[c] || 0, r: rCountries[c] || 0 }))
    .sort((a, b) => b.p + b.r - (a.p + a.r))
    .slice(0, 12);
  const maxC = Math.max(1, ...countries.flatMap((x) => [x.p, x.r]));
  const participants = S.stats.participants ?? sum(pCountries);
  const researchers = S.stats.researchers ?? sum(rCountries);
  const openStudies = S.stats.openStudies ?? S.studies.length;
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
    const toPts = (obj) => Object.entries(obj).map(([c, n]) => ({ ...countryInfo(c), n })).filter((p) => p.iso);
    const pPts = toPts(pCountries);
    const rPts = toPts(rCountries);
    const size = (n) => 4 + Math.sqrt(n) * 2.2;
    let map = null;
    try {
      map = new window.jsVectorMap({
        selector: el,
        map: "world",
        zoomOnScroll: false,
        zoomButtons: true,
        backgroundColor: "transparent",
        regionStyle: { initial: { fill: v("--map-land"), stroke: v("--paper-2"), strokeWidth: 0.4 }, hover: { fillOpacity: 0.85, cursor: "default" } },
        markers: [
          // Participants and researchers sit in different colours. Researchers are nudged slightly so both show in one country.
          ...pPts.map((p) => ({ name: `${p.name}: ${plural(p.n, "participant", "participants")}`, coords: [p.lat, p.lng], style: { initial: { fill: v("--blue"), r: size(p.n) } } })),
          ...rPts.map((p) => ({ name: `${p.name}: ${plural(p.n, "researcher", "researchers")}`, coords: [p.lat - 1.6, p.lng + 1.6], style: { initial: { fill: v("--amber"), r: size(p.n) } } })),
        ],
        markerStyle: {
          initial: { stroke: v("--card"), strokeWidth: 2, strokeOpacity: 1, fillOpacity: 0.95 },
          hover: { cursor: "pointer" },
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
          <p className="soft">Where participants and researchers on HumAIn Labs are based. Hover a marker for the count.</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <b>{participants}</b>
          <span className="small soft">registered participants</span>
        </div>
        <div className="stat">
          <b>{openStudies}</b>
          <span className="small soft">open studies</span>
        </div>
        <div className="stat">
          <b>{researchers}</b>
          <span className="small soft">researchers</span>
        </div>
      </div>
      <div className="mapbox">
        <div id="map" ref={box} />
      </div>
      <h2 className="h2sm" style={{ marginTop: 22 }}>Participants and researchers by country</h2>
      <div className="cmp-legend small">
        <span>
          <i className="dot dot-blue" aria-hidden="true" /> Participants
        </span>
        <span>
          <i className="dot dot-amber" aria-hidden="true" /> Researchers
        </span>
      </div>
      <div className="split" role="list" aria-label="Participants and researchers by country">
        {countries.map((x) => (
          <div className="split-item" key={x.c} role="listitem" aria-label={`${x.c}: ${x.p} participants, ${x.r} researchers`}>
            <div className="split-name">{x.c}</div>
            <div className="split-line">
              <span className="split-num blue">{x.p}</span>
              <div className="split-track">
                <i className="split-left" style={{ width: `${x.p + x.r ? (x.p / (x.p + x.r)) * 100 : 50}%` }} />
                <i className="split-right" style={{ width: `${x.p + x.r ? (x.r / (x.p + x.r)) * 100 : 50}%` }} />
              </div>
              <span className="split-num amber">{x.r}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MyApplications({ onWithdraw }) {
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
                <ApplicationStages app={a} />
                <div className="foot">
                  {a.status === "withdrawn" ? (
                    <span className="unverified">{a.withdrawReason === "eligibility" ? "Not eligible, withdrawn" : "Withdrew"} {fmtDate(a.withdrawnAt)}</span>
                  ) : (
                    <span className="small">The researcher will contact you at {a.email}</span>
                  )}
                  {a.status !== "withdrawn" && today() < s.closesAt && (
                    <button className="btn" type="button" onClick={() => onWithdraw?.(a, s)}>
                      Withdraw
                    </button>
                  )}
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
const CONTACT_EMAIL = SITE.contactEmail;
// The team. Replace the placeholder names, roles and bios before launch.
const FOUNDERS = [
  {
    name: "Dr Sasan Radan",
    role: "Founder",
    based: "",
    photo: founderPhoto,
    bio: "Started HumAIn to make it easier for research to reach the people it's about, and for researchers to find each other.",
    linkedin: "", // ← paste the LinkedIn profile URL here
  },
  {
    name: "Team member name", // ← placeholder
    role: "Role",
    based: "",
    photo: "",
    bio: "A line about what they do at HumAIn Labs.",
    linkedin: "",
  },
  {
    name: "Team member name", // ← placeholder
    role: "Role",
    based: "",
    photo: "",
    bio: "A line about what they do at HumAIn Labs.",
    linkedin: "",
  },
];
// Sponsors are grouped by tier. Replace the placeholder names and notes before launch.
const SPONSOR_TIERS = [
  { tier: "Gold", cls: "tier-gold", note: "Our lead supporters.", items: [{ name: "Sponsor name", note: "What they support." }] },
  { tier: "Silver", cls: "tier-silver", note: "Long-term supporters.", items: [{ name: "Sponsor name", note: "What they support." }] },
  { tier: "Standard", cls: "tier-standard", note: "Supporters of the platform.", items: [{ name: "Sponsor name", note: "What they support." }] },
];
const PARTNERS = [
  { name: "Partner name", kind: "University or research institute", note: "A line about what you work on together." },
  { name: "Partner name", kind: "Funder or industry partner", note: "A line about what you work on together." },
  { name: "Partner name", kind: "Participant community or charity", note: "A line about what you work on together." },
];

export function About() {
  const route = useRoute();
  // Footer links to #/about?to=contact jump to the contact section.
  useEffect(() => {
    if (route.q.get("to") === "contact") document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [route]);
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
            <span className="tnum ok">
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
            <span className="tnum warm">
              <Icon.mail />
            </span>
            <h3>Keep it direct</h3>
            <p className="soft small">Applications go straight to the researcher running the study, and nobody else sees them.</p>
          </div>
        </div>
      </section>

      <section className="home-sec" id="hlg">
        <h2 className="h2big">Your HLG identifier</h2>
        <div className="hlg-explain">
          <HlgBadge size={48} spin />
          <div>
            <p className="soft">
              Every research group on HumAIn Labs gets a permanent identifier, the way researchers get an ORCID iD. It starts with HLG and looks like
              HLG-XXXX-XXXX-XX. It doesn't change when a group renames or moves, so you can quote it on papers, adverts and applications.
            </p>
            <p className="soft small" style={{ marginTop: 8 }}>
              The last two characters are a check, so a mistyped ID is caught straight away. Wherever a group's ID appears, the HumAIn Labs badge sits
              beside it.
            </p>
          </div>
        </div>
      </section>

      <section className="home-sec">
        <h2 className="h2big">Meet the team</h2>
        <p className="soft" style={{ maxWidth: "66ch", marginTop: 8 }}>
          HumAIn Labs is built by people who have been on both sides of a study: waiting on recruitment that stalls, and hearing about research only
          once it has finished. The team is small, so you can reach us directly.
        </p>
        <div className="grid people-grid" style={{ marginTop: 20 }}>
          {FOUNDERS.map((f) => (
            <article className="card" key={f.name}>
              <div className="body">
                <div className="person">
                  {f.photo ? (
                    <img className="headshot" src={f.photo} alt={f.name} width="56" height="56" />
                  ) : (
                    <span className="headshot initials" aria-hidden="true">
                      {f.name.trim().slice(0, 1).toUpperCase()}
                    </span>
                  )}
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

      <section className="home-sec">
        <div className="intro">
          <div>
            <h2 className="h2big">Sponsors</h2>
            <p className="soft">Organisations that fund HumAIn Labs, grouped by the level of their support.</p>
          </div>
        </div>
        <div className="sponsor-tiers">
          {SPONSOR_TIERS.map((t) => (
            <div className={"tier " + t.cls} key={t.tier}>
              <h3>
                <span className="tier-dot" aria-hidden="true" />
                {t.tier} sponsors
              </h3>
              <p className="small soft">{t.note}</p>
              {t.items.map((x, i) => (
                <div className="tier-logo" key={i}>
                  <strong>{x.name}</strong>
                  <div className="small soft">{x.note}</div>
                </div>
              ))}
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

      <section className="home-sec" id="contact">
        <h2>Contact</h2>
        <p className="soft">Choose the address that fits your question.</p>
        <div className="contact-grid">
          <a className="contact-card" href={`mailto:${SITE.contactEmail}`}>
            <strong>General enquiries</strong>
            <span>{SITE.contactEmail}</span>
          </a>
          <a className="contact-card" href={`mailto:${SITE.reportEmail}?subject=${encodeURIComponent("Report a study or profile")}`}>
            <strong>Report a study or profile</strong>
            <span>{SITE.reportEmail}</span>
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

import { useCallback, useEffect, useState } from "react";
import { SHIPPED, UPCOMING } from "../lib/changelog.js";
import { fmtDate } from "../lib/util.js";
import { Icon } from "../components/ui.jsx";
import { AUTH } from "../lib/store.js";

const WINDOW = 90;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

// Each part of the service is checked in the browser, right now, against something that would
// really fail if it were broken. Nothing here is assumed to be working.
const PARTS = [
  {
    key: "website",
    name: "Website",
    note: "The pages themselves, served from Azure Static Web Apps.",
    // This page is on screen, so the site served it. The check confirms it can still fetch from itself.
    probe: () => fetch(location.pathname, { cache: "no-store" }).then((r) => r.ok),
  },
  {
    key: "api",
    name: "Public API",
    note: "Studies, researchers and groups, and everything behind signing in.",
    // A 404 means this build simply has no API behind it; anything else is a fault.
    probe: () => fetch("/api/health", { cache: "no-store" }).then((r) => (r.ok ? true : r.status === 404 ? "absent" : false)),
  },
  {
    key: "database",
    name: "Database",
    note: "Where studies, profiles and applications are kept.",
    // Reading public data goes all the way through to Cosmos DB and back.
    probe: () =>
      fetch("/api/public", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
        .then((d) => Array.isArray(d.studies)),
  },
];

// Runs every probe at once and keeps the result for each part.
function useChecks() {
  const [state, setState] = useState({ phase: "checking", parts: {}, at: null });
  const run = useCallback(() => {
    setState((s) => ({ ...s, phase: "checking" }));
    const guard = (p) =>
      Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]).then(
        (okish) => (okish === "absent" ? "absent" : !!okish),
        () => false
      );
    Promise.all(PARTS.map((part) => guard(part.probe()))).then((results) => {
      const parts = {};
      PARTS.forEach((part, i) => (parts[part.key] = results[i]));
      setState({ phase: "done", parts, at: new Date() });
    });
  }, []);
  useEffect(() => {
    run();
  }, [run]);
  return [state, run];
}

// The recorded history behind the bars. Without it the bars stay grey rather than guessing.
function useHistory() {
  const [hist, setHist] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/api/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d) => live && setHist(d))
      .catch(() => live && setHist({ days: [], recordingSince: null, database: false }));
    return () => {
      live = false;
    };
  }, []);
  return hist;
}

// One slot per day, oldest on the left. A day nobody checked is grey: it is not counted as up.
function UptimeBar({ byDay, live }) {
  const todayKey = dayKey(Date.now());
  const slots = [];
  for (let i = WINDOW - 1; i >= 0; i--) {
    const key = dayKey(Date.now() - i * 86400000);
    const rec = byDay.get(key);
    let cls = "none";
    let label = "no checks recorded";
    if (rec) {
      const bad = rec.fails || 0;
      cls = bad === 0 ? "up" : bad >= rec.checks ? "down" : "part";
      label = `${rec.checks - bad} of ${rec.checks} checks passed`;
    }
    if (key === todayKey && live != null && !rec) {
      cls = live ? "up" : "down";
      label = live ? "responding now" : "not responding now";
    }
    slots.push(<i key={key} className={"ub-day " + cls} title={`${fmtDate(key)}: ${label}`} />);
  }
  return (
    <div className="ub" role="img" aria-label={`Uptime for the last ${WINDOW} days`}>
      {slots}
    </div>
  );
}

function Part({ part, ok, byDay, loading }) {
  const state = ok == null ? (loading ? "checking" : "unknown") : ok ? "up" : "down";
  const pill = { checking: "Checking…", unknown: "Not checked", up: "Operational", down: "Not responding" }[state];
  // Only recorded days count, so an empty record reads "no data" rather than 100%.
  let passed = 0;
  let total = 0;
  for (const r of byDay.values()) {
    total += r.checks || 0;
    passed += (r.checks || 0) - (r.fails || 0);
  }
  const pct = total ? Math.round((passed / total) * 1000) / 10 : null;
  return (
    <section className="svc">
      <div className="svc-head">
        <div>
          <h2>{part.name}</h2>
          <p className="small soft" style={{ margin: "2px 0 0" }}>
            {part.note}
          </p>
        </div>
        <span className={"svc-pill " + state}>{pill}</span>
      </div>
      <UptimeBar byDay={byDay} live={ok} />
      <div className="svc-foot small soft">
        <span>{WINDOW} days ago</span>
        <span className="svc-rule" aria-hidden="true" />
        <span className="svc-pct">{pct == null ? "No history yet" : `${pct}% of recorded checks passed`}</span>
        <span className="svc-rule" aria-hidden="true" />
        <span>today</span>
      </div>
    </section>
  );
}

// Votes on what to build next. Everyone sees the counts; casting one needs an account, so the
// numbers mean something rather than counting whoever clicked most.
function useVotes() {
  const [state, setState] = useState({ items: {}, available: false, busy: null });
  const load = useCallback(() => {
    fetch("/api/roadmap", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d) => {
        const items = {};
        (d.items || []).forEach((i) => (items[i.id] = i));
        setState({ items, available: !!d.available, busy: null });
      })
      .catch(() => setState({ items: {}, available: false, busy: null }));
  }, []);
  useEffect(load, [load]);

  const cast = useCallback((id, vote) => {
    setState((s) => ({ ...s, busy: id }));
    fetch(`/api/roadmap/${encodeURIComponent(id)}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((i) => setState((s) => ({ ...s, items: { ...s.items, [i.id]: i }, busy: null })))
      .catch(() => setState((s) => ({ ...s, busy: null })));
  }, []);
  return [state, cast];
}

function VoteButtons({ item, votes, cast }) {
  const tally = votes.items[item.id] || { up: 0, down: 0, mine: null };
  const busy = votes.busy === item.id;
  // Without an account the counts still show, as plain figures rather than buttons that would fail.
  if (!AUTH.user)
    return (
      <div className="vote readonly" aria-label={`${tally.up} for, ${tally.down} against`}>
        <span className="vote-count">
          <Icon.voteUp />
          {tally.up}
        </span>
        <span className="vote-count">
          <Icon.voteDown />
          {tally.down}
        </span>
      </div>
    );
  return (
    <div className="vote" role="group" aria-label={`How much do you want ${item.title}?`}>
      <button
        className={"vote-btn" + (tally.mine === "up" ? " on" : "")}
        onClick={() => cast(item.id, "up")}
        disabled={busy}
        aria-pressed={tally.mine === "up"}
        title={tally.mine === "up" ? "Take your vote back" : "Build this sooner"}
      >
        <Icon.voteUp />
        <span>{tally.up}</span>
      </button>
      <button
        className={"vote-btn down" + (tally.mine === "down" ? " on" : "")}
        onClick={() => cast(item.id, "down")}
        disabled={busy}
        aria-pressed={tally.mine === "down"}
        title={tally.mine === "down" ? "Take your vote back" : "This one can wait"}
      >
        <Icon.voteDown />
        <span>{tally.down}</span>
      </button>
    </div>
  );
}

// Updates stay closed until opened, so the list reads as a summary rather than a wall of text.
function UpdateItem({ entry, open, onToggle }) {
  const id = "upd-" + entry.date + "-" + entry.title.replace(/\W+/g, "-").toLowerCase();
  return (
    <li className={"log-item open-item" + (open ? " is-open" : "")}>
      <span className="log-when small soft">
        <time dateTime={entry.date}>{fmtDate(entry.date)}</time>
      </span>
      <div>
        <button className="log-toggle" onClick={onToggle} aria-expanded={open} aria-controls={id}>
          <strong>{entry.title}</strong>
          <Icon.chev />
        </button>
        {open && (
          <p className="small soft" id={id} style={{ margin: "6px 0 0" }}>
            {entry.body}
          </p>
        )}
      </div>
    </li>
  );
}

export function Status() {
  const [checks, recheck] = useChecks();
  const hist = useHistory();
  const [votes, cast] = useVotes();
  const [openUpdate, setOpenUpdate] = useState(null);
  const [showUpdates, setShowUpdates] = useState(false);
  const byDay = new Map((hist?.days || []).map((d) => [d.day, d]));

  const results = PARTS.map((p) => checks.parts[p.key]);
  const known = results.filter((r) => r != null);
  const down = known.filter((r) => r === false).length;
  // No API at all is a build without one, not an outage.
  const isDemo = checks.parts.api === "absent";
  const banner = isDemo
    ? { tone: "demo", text: "Demo build, no service to check" }
    : checks.phase === "checking"
      ? { tone: "wait", text: "Checking the service…" }
      : down === 0
        ? { tone: "ok", text: "All Systems Operational" }
        : down === known.length
          ? { tone: "down", text: "Major Outage" }
          : { tone: "part", text: "Partial Outage" };
  const time = checks.at ? checks.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="wrap status-page">
      <div className="intro">
        <div>
          <p className="eyebrow">Status</p>
          <h1>HumAIn Labs status</h1>
          <p className="soft lead">Checked live in your browser each time you open this page.</p>
        </div>
        <button className="btn" onClick={recheck} disabled={checks.phase === "checking"}>
          Check again
        </button>
      </div>

      <section className={"status-banner " + banner.tone} aria-live="polite">
        {banner.tone === "ok" ? <Icon.check /> : <Icon.alert />}
        <strong>{banner.text}</strong>
        {time && <span className="status-when">Checked {time}</span>}
      </section>

      {isDemo ? (
        <div className="empty" style={{ padding: 30 }}>
          <div>This copy runs on sample data in your browser, with no service behind it to check.</div>
        </div>
      ) : (
        <>
          {PARTS.map((p) => (
            <Part key={p.key} part={p} ok={checks.parts[p.key]} byDay={byDay} loading={checks.phase === "checking"} />
          ))}
          <p className="small soft status-note">
            The bars come from checks the service records about itself, roughly once a minute while anyone is using the site.
            {hist?.recordingSince ? ` Recording began on ${fmtDate(hist.recordingSince)}.` : " No checks have been recorded yet."} A grey day is one
            with no checks on record, not a day counted as working, and a complete outage leaves a gap rather than a red mark, because nothing is
            running to write one down.
          </p>
        </>
      )}

      <section className="dash-sec" style={{ marginTop: 40 }}>
        <div className="intro">
          <div>
            <h2>Coming next</h2>
            <p className="soft small">
              What we are building. No dates promised until the work is done.
              {votes.available ? (AUTH.user ? " Tell us which you want first." : " Sign in to say which you want first.") : ""}
            </p>
          </div>
        </div>
        <ul className="log">
          {UPCOMING.map((u) => (
            <li key={u.id} className="log-item upcoming">
              <span className="log-when small soft">Planned</span>
              <div>
                <strong>{u.title}</strong>
                <p className="small soft" style={{ margin: "2px 0 0" }}>
                  {u.body}
                </p>
              </div>
              {votes.available && <VoteButtons item={u} votes={votes} cast={cast} />}
            </li>
          ))}
        </ul>
        {votes.available && !AUTH.user && (
          <p className="small soft" style={{ marginTop: 12 }}>
            <a href="#/auth?mode=signin">Sign in</a> to vote. One vote each, and you can change it later.
          </p>
        )}
      </section>

      <section className={"dash-sec" + (showUpdates ? " is-open" : "")}>
        <button className="sec-toggle" onClick={() => setShowUpdates(!showUpdates)} aria-expanded={showUpdates} aria-controls="update-log">
          <span>
            <h2>Updates</h2>
            <span className="soft small">
              {SHIPPED.length} so far, newest first. {showUpdates ? "Open one to read what changed." : "Tap to see them."}
            </span>
          </span>
          <Icon.chev />
        </button>
        {showUpdates && (
          <ul className="log" id="update-log">
            {SHIPPED.map((u) => {
              const key = u.date + u.title;
              return <UpdateItem key={key} entry={u} open={openUpdate === key} onToggle={() => setOpenUpdate(openUpdate === key ? null : key)} />;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

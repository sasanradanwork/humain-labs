import { useCallback, useEffect, useState } from "react";
import { SHIPPED, UPCOMING } from "../lib/changelog.js";
import { fmtDate } from "../lib/util.js";
import { useUI } from "../lib/ui.jsx";

// Asks the API whether it is up. The demo build has no API behind it, which is not a fault,
// so the two cases are reported differently.
function useHealth(isDemo) {
  const [state, setState] = useState({ phase: "checking", ms: 0, at: null });
  const check = useCallback(() => {
    if (isDemo) {
      setState({ phase: "demo", ms: 0, at: new Date() });
      return;
    }
    setState((s) => ({ ...s, phase: "checking" }));
    const started = performance.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch("/api/health", { cache: "no-store", signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then(() => setState({ phase: "up", ms: Math.round(performance.now() - started), at: new Date() }))
      .catch(() => setState({ phase: "down", ms: Math.round(performance.now() - started), at: new Date() }))
      .finally(() => clearTimeout(timer));
  }, [isDemo]);

  useEffect(() => {
    check();
  }, [check]);
  return [state, check];
}

const LOOK = {
  checking: { dot: "wait", title: "Checking…", text: "Asking the service whether it is responding." },
  up: { dot: "ok", title: "All systems operational", text: "The site and its API are responding normally." },
  down: { dot: "bad", title: "The API is not responding", text: "You can still read the site, but signing in, applying and posting may not work." },
  demo: { dot: "wait", title: "Demo mode", text: "This copy runs on sample data in your browser, with no API behind it. Nothing you do here is saved to a server." },
};

export function Status() {
  const { backend } = useUI();
  const [health, recheck] = useHealth(backend?.kind !== "azure");
  const look = LOOK[health.phase];
  const time = health.at ? health.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div className="wrap">
      <div className="intro">
        <div>
          <p className="eyebrow">Status</p>
          <h1>Is everything working?</h1>
          <p className="soft lead">A live check of the service, and a log of what has changed on the site.</p>
        </div>
      </div>

      <section className={"status-now " + health.phase} aria-live="polite">
        <span className={"status-dot " + look.dot} aria-hidden="true" />
        <div className="grow">
          <strong>{look.title}</strong>
          <p className="small soft" style={{ margin: "2px 0 0" }}>
            {look.text}
            {health.phase === "up" ? ` Answered in ${health.ms} ms.` : ""}
          </p>
        </div>
        <div className="status-recheck">
          {time && <span className="small soft">Checked {time}</span>}
          <button className="btn" onClick={recheck} disabled={health.phase === "checking"}>
            Check again
          </button>
        </div>
      </section>

      <section className="dash-sec">
        <div className="intro">
          <div>
            <h2>Coming next</h2>
            <p className="soft small">What we are building. No dates promised until the work is done.</p>
          </div>
        </div>
        <ul className="log">
          {UPCOMING.map((u) => (
            <li key={u.title} className="log-item upcoming">
              <span className="log-when small soft">Planned</span>
              <div>
                <strong>{u.title}</strong>
                <p className="small soft" style={{ margin: "2px 0 0" }}>
                  {u.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="dash-sec">
        <div className="intro">
          <div>
            <h2>Updates</h2>
            <p className="soft small">Newest first.</p>
          </div>
        </div>
        <ul className="log">
          {SHIPPED.map((u) => (
            <li key={u.date + u.title} className="log-item">
              <span className="log-when small soft">
                <time dateTime={u.date}>{fmtDate(u.date)}</time>
              </span>
              <div>
                <strong>{u.title}</strong>
                <p className="small soft" style={{ margin: "2px 0 0" }}>
                  {u.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

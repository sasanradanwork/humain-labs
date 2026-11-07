import { useState } from "react";
import { Modal } from "../lib/ui.jsx";
import { Icon } from "./ui.jsx";
import { consent, setConsent } from "../lib/cookies.js";

// The settings themselves. Strictly necessary storage has no switch, because the site
// cannot sign you in without it; preferences do, and turning them off clears what was kept.
function CookieSettings({ onClose }) {
  const [prefs, setPrefs] = useState(consent().preferences);
  return (
    <Modal onClose={onClose}>
      <h2>Cookies and storage</h2>
      <p className="small soft">
        HumAIn Labs keeps as little as it can in your browser. There is no advertising, and nothing here is shared with third parties for tracking.
      </p>
      <div className="stack" style={{ marginTop: 16 }}>
        <div className="ck-row">
          <div>
            <strong>Strictly necessary</strong>
            <p className="small soft" style={{ margin: "2px 0 0" }}>
              The cookie that keeps you signed in, and, in the demo, the sample data held in your browser. The site cannot work without these, so
              they cannot be switched off.
            </p>
          </div>
          <span className="ck-fixed small">Always on</span>
        </div>
        <div className="ck-row">
          <div>
            <strong>Preferences</strong>
            <p className="small soft" style={{ margin: "2px 0 0" }}>
              Remembers whether you chose light or dark mode on this device. Switching this off clears that straight away.
            </p>
          </div>
          <label className="ck-switch">
            <input type="checkbox" checked={prefs} onChange={(e) => setPrefs(e.target.checked)} />
            <span>{prefs ? "On" : "Off"}</span>
          </label>
        </div>
      </div>
      <p className="small soft" style={{ marginTop: 14 }}>
        More detail is in the <a href="#/privacy">privacy policy</a>.
      </p>
      <div className="actions" style={{ marginTop: 18 }}>
        <button
          className="btn btn-solid"
          onClick={() => {
            setConsent({ preferences: prefs });
            onClose();
          }}
        >
          Save choices
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

// Sits in the bottom-left corner on every page.
export function CookieButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="cookie-btn" onClick={() => setOpen(true)} aria-label="Cookie settings" title="Cookie settings">
        <Icon.cookie />
      </button>
      {open && <CookieSettings onClose={() => setOpen(false)} />}
    </>
  );
}

// App-wide plumbing React components share: the hash route, the theme, toasts,
// modals and the small form helper that keeps native validation.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserError } from "./util.js";

/* ---------- hash routing ---------- */
export function parseRoute(hash) {
  const [path, query] = (hash || "#/").replace(/^#\/?/, "").split("?");
  const parts = path.split("/");
  return {
    page: parts[0] || "home",
    id: parts[1] ? decodeURIComponent(parts[1]) : null,
    sub: parts[2] || null,
    q: new URLSearchParams(query || ""),
  };
}
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash || "#/");
  useEffect(() => {
    const on = () => {
      setHash(location.hash || "#/");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return useMemo(() => parseRoute(hash), [hash]);
}
export const navigate = (hash) => {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
};
export const replaceRoute = (hash) => {
  history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
};

/* ---------- theme ---------- */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "");
  const dark = theme ? theme === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggle = useCallback(() => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("humain-labs-theme", next);
    } catch (e) {}
    setTheme(next);
  }, [dark]);
  return { dark, toggle };
}

export const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---------- toasts and modals ---------- */
const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children, value }) {
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function Modal({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="x" type="button" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * A form that keeps the browser's own validation, hands back trimmed values,
 * and shows "Saving…" while the handler runs.
 */
export function Form({ onSubmit, children, className, id }) {
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) return form.reportValidity();
    const data = Object.fromEntries(new FormData(form));
    Object.keys(data).forEach((k) => typeof data[k] === "string" && (data[k] = data[k].trim()));
    setBusy(true);
    try {
      await onSubmit(data, form);
    } catch (err) {
      ui?.toast(err instanceof UserError ? err.message : err?.message || "That couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form id={id} className={className} noValidate onSubmit={submit} data-busy={busy ? "1" : undefined}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={busy}>
        {children}
      </fieldset>
    </form>
  );
}

export function SubmitButton({ children, className = "btn btn-solid btn-full", style }) {
  return (
    <button className={className} type="submit" style={style}>
      {children}
    </button>
  );
}

/** Labelled form field, matching the old markup so the styling is unchanged. */
export function Field({ label, required, hint, children }) {
  return (
    <label className="f">
      <span className={required ? "req" : undefined}>{label}</span>
      {children}
      {hint}
    </label>
  );
}

export function autoFocusFirst(node) {
  node?.querySelector("input:not([type=hidden]):not([disabled]),select,textarea,a.btn")?.focus();
}

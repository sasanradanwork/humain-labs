// What the site is allowed to keep in this browser.
//
// Two kinds of storage are in play, and they are treated differently:
//   - Strictly necessary: the sign-in cookie, and in the demo the copy of the demo data.
//     Without these the site cannot do what you asked it to, so there is nothing to opt out of.
//   - Preferences: the light or dark mode choice. This one is a real choice, and turning it
//     off clears what was already stored.
// There is no advertising or third-party analytics storage to ask about.

const KEY = "humain-labs-cookies";
const THEME_KEY = "humain-labs-theme";

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v === "object" ? v : null;
  } catch (e) {
    return null;
  }
};

// Preferences are on until someone says otherwise: nothing here identifies a person
// or follows them anywhere, and a remembered theme is what people expect.
export const consent = () => ({ preferences: read()?.preferences !== false, decided: !!read() });
export const prefsAllowed = () => consent().preferences;

export function setConsent({ preferences }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ preferences: !!preferences, at: new Date().toISOString() }));
    // Turning preferences off clears what was kept under them, rather than only stopping new writes.
    if (!preferences) localStorage.removeItem(THEME_KEY);
    else if (document.documentElement.dataset.theme) localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme);
  } catch (e) {}
  window.dispatchEvent(new CustomEvent("humain-cookies"));
}


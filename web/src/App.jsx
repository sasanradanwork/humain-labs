import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Icon, Logo } from "./components/ui.jsx";
import { ApplyModal, ConfirmModal, RorModal, ScholarModal, StudyModal, VerifyModal } from "./components/modals.jsx";
import { About, Auth, Home, MyApplications, Reach, Studies } from "./pages/public.jsx";
import { Dashboard, GroupEditor, GroupPage, Groups, ProfileEditor, Researchers, groupByRef } from "./pages/researcher.jsx";
import { AUTH, S, byId, role, useStore } from "./lib/store.js";
import { fallbackBackend, pickBackend, setToaster } from "./lib/backends.js";
import { UIProvider, navigate, useRoute, useTheme } from "./lib/ui.jsx";
import { appCount, canEditGroup } from "./lib/store.js";
import { plural } from "./lib/util.js";
import { SITE } from "./lib/site.js";
import { Privacy, Terms } from "./pages/legal.jsx";

// Researchers and participants see different parts of the site.
const NAV = {
  guest: [["home", "Home"], ["studies", "Studies"], ["reach", "Reach"], ["about", "About"]],
  participant: [["home", "Home"], ["studies", "Studies"], ["reach", "Reach"], ["mine", "My applications"]],
  researcher: [["home", "Home"], ["studies", "Studies"], ["researchers", "Researchers"], ["groups", "Groups"], ["reach", "Reach"], ["dashboard", "Profile"]],
};
const TITLES = {
  about: "About", auth: "Sign in or register", home: "Research needs people", studies: "Open studies", researchers: "Researchers",
  groups: "Research groups", reach: "Global reach", mine: "My applications", dashboard: "Researcher area", profile: "Your profile",
  terms: "Terms and conditions", privacy: "Privacy policy",
};
const PAGES = new Set(Object.keys(TITLES));

const MenuGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
const CloseGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default function App() {
  useStore();
  const route = useRoute();
  const { dark, toggle } = useTheme();
  const [backend, setBackend] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [modal, setModal] = useState(null);
  const [afterAuth, setAfterAuth] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filters, setFilters] = useState({
    studies: { q: "", field: "", country: "", format: "", sort: "" },
    researchers: { q: "", field: "", country: "", institution: "", verified: false },
    groups: { q: "", field: "", country: "", looking: "", open: false },
  });

  const toast = useCallback((message) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg((m) => (m === message ? "" : m)), 4200);
  }, []);
  useEffect(() => setToaster(toast), [toast]);

  useEffect(() => {
    let live = true;
    (async () => {
      let b;
      try {
        b = await pickBackend();
        await b.init();
      } catch (e) {
        console.error(e);
        b = fallbackBackend();
        await b.init();
        toast("Couldn't reach the server, so you're seeing demo data.");
      }
      if (live) setBackend(b);
    })();
    return () => {
      live = false;
    };
  }, [toast]);

  const closeModal = useCallback(() => setModal(null), []);
  const openAuth = (mode) => {
    setMenuOpen(false);
    setAfterAuth({ hash: location.hash || "#/" });
    navigate(`#/auth?mode=${mode}&as=participant`);
  };

  // The phone menu closes when the page changes and on Escape.
  useEffect(() => setMenuOpen(false), [route.page, route.id]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  const requireLogin = useCallback(
    (then) => {
      if (AUTH.user) return then();
      setAfterAuth({ hash: location.hash || "#/", then });
      navigate("#/auth?mode=signin&as=participant");
    },
    []
  );
  const onApply = useCallback((study) => requireLogin(() => setModal({ kind: "apply", study })), [requireLogin]);

  const setPageFilters = (page) => (next) => setFilters((f) => ({ ...f, [page]: next }));

  useEffect(() => {
    const name =
      route.page === "groups" && route.id && route.id !== "new" && route.sub !== "edit"
        ? groupByRef(route.id)?.name || "Research group"
        : TITLES[route.page];
    document.title = `${name} · HumAIn Labs`;
    document.body.classList.toggle("on-home", route.page === "home");
    document.body.dataset.role = role();
  }, [route, backend, AUTH.researcher]);

  useEffect(() => {
    if (backend && !PAGES.has(route.page)) navigate("#/studies");
  }, [route.page, backend]);

  const ui = useMemo(() => ({ backend, toast, closeModal }), [backend, toast, closeModal]);
  const navPage = route.page === "profile" ? "dashboard" : route.page;

  let body = null;
  if (!backend) body = <div className="loading" style={{ padding: "80px 0" }}>Loading…</div>;
  else
    switch (route.page) {
      case "home":
        body = <Home onApply={onApply} setStudyQuery={(q) => setPageFilters("studies")({ ...filters.studies, q })} />;
        break;
      case "studies":
        body = <Studies filters={filters.studies} setFilters={setPageFilters("studies")} onApply={onApply} />;
        break;
      case "researchers":
        body = <Researchers filters={filters.researchers} setFilters={setPageFilters("researchers")} />;
        break;
      case "groups":
        body =
          route.id === "new" || route.sub === "edit" ? (
            <GroupEditor
              route={route}
              onRor={(seed, onPick) => setModal({ kind: "ror", seed, onPick })}
              onDelete={(g) =>
                setModal({
                  kind: "confirm",
                  title: "Delete this group?",
                  text: `The page for ${g.name} will be removed. Studies linked to it stay open. This can't be undone.`,
                  label: "Delete group",
                  onConfirm: async () => {
                    await backend.deleteGroup(g.id);
                    toast("Group deleted.");
                    navigate("#/dashboard");
                  },
                })
              }
            />
          ) : route.id ? (
            <GroupPage route={route} onApply={onApply} />
          ) : (
            <Groups filters={filters.groups} setFilters={setPageFilters("groups")} />
          );
        break;
      case "reach":
        body = <Reach dark={dark} />;
        break;
      case "mine":
        body = <MyApplications />;
        break;
      case "dashboard":
        body = (
          <Dashboard
            route={route}
            onVerify={() => setModal({ kind: "verify" })}
            onScholar={() => setModal({ kind: "scholar" })}
            onNewStudy={() => setModal(AUTH.researcher?.verified ? { kind: "study" } : { kind: "verify" })}
            onEditStudy={(s) => setModal({ kind: "study", existing: s })}
            onDeleteStudy={(s) =>
              setModal({
                kind: "confirm",
                title: "Remove this study?",
                text: `“${s.title}” will be taken down and its ${plural(appCount(s.id), "application", "applications")} deleted. This can't be undone.`,
                label: "Remove study",
                onConfirm: async () => {
                  await backend.deleteStudy(s.id);
                  toast("Study removed.");
                },
              })
            }
          />
        );
        break;
      case "profile":
        body = <ProfileEditor onVerify={() => setModal({ kind: "verify" })} onScholar={() => setModal({ kind: "scholar" })} />;
        break;
      case "terms":
        body = <Terms />;
        break;
      case "privacy":
        body = <Privacy />;
        break;
      case "about":
        body = <About />;
        break;
      case "auth":
        body = <Auth route={route} afterAuth={afterAuth} setAfterAuth={setAfterAuth} />;
        break;
      default:
        body = null;
    }

  return (
    <UIProvider value={ui}>
      <header>
        <div className="wrap">
          <div className="head">
            <a className="brand" href="#/" aria-label="HumAIn Labs home" onClick={() => setMenuOpen(false)}>
              <Logo animated steam={false} />
            </a>
            <nav
              id="nav"
              className={menuOpen ? "open" : undefined}
              aria-label="Sections"
              onClick={(e) => e.target.closest("a") && setMenuOpen(false)}
            >
              {NAV[role()].map(([k, label]) => (
                <a key={k} href={`#/${k === "home" ? "" : k}`} data-page={k} aria-current={k === navPage ? "page" : "false"}>
                  {label}
                </a>
              ))}
              <div className="menu-extra">
                <button className="btn" onClick={toggle}>
                  {dark ? <Icon.sun /> : <Icon.moon />}
                  {dark ? "Light mode" : "Dark mode"}
                </button>
                {AUTH.user ? (
                  <>
                    <span className="menu-account">
                      <Avatar name={AUTH.researcher?.name || AUTH.user.name || "you"} size={30} />
                      <span className="role-tag">{role() === "researcher" ? "Researcher" : "Participant"}</span>
                    </span>
                    <button className="btn" onClick={() => backend.signOut()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn" onClick={() => openAuth("signin")}>
                      Sign in
                    </button>
                    <button className="btn btn-solid" onClick={() => openAuth("register")}>
                      Register
                    </button>
                  </>
                )}
              </div>
            </nav>
            <div className="who" id="who">
              <button
                className="btn icon-btn theme-btn desk"
                onClick={toggle}
                aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
                title={`Switch to ${dark ? "light" : "dark"} mode`}
              >
                {dark ? <Icon.sun /> : <Icon.moon />}
              </button>
              {AUTH.user ? (
                <>
                  <span className="who-name desk" title={`Signed in as ${AUTH.researcher?.name || AUTH.user.name} (${role()} account)`}>
                    <Avatar name={AUTH.researcher?.name || AUTH.user.name || "you"} size={30} />
                    <span className="role-tag">{role() === "researcher" ? "Researcher" : "Participant"}</span>
                  </span>
                  <button className="btn desk" onClick={() => backend.signOut()}>
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button className="btn desk" onClick={() => openAuth("signin")}>
                    Sign in
                  </button>
                  <button className="btn btn-solid desk" onClick={() => openAuth("register")}>
                    Register
                  </button>
                </>
              )}
              <button
                className="btn icon-btn menu-btn"
                type="button"
                aria-controls="nav"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? <CloseGlyph /> : <MenuGlyph />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <div id="app">{body}</div>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div className="footer-brand">
            <strong>HumAIn Labs</strong>
            <span className="soft">Research needs people.</span>
          </div>
          <nav aria-label="Footer">
            <a href="#/about">About</a>
            <a href="#/about?to=contact">Contact</a>
            <a href="#/terms">Terms and conditions</a>
            <a href="#/privacy">Privacy policy</a>
          </nav>
          <p className="small soft footer-legal">
            © {new Date().getFullYear()} {SITE.legalName} · Company number {SITE.companyNumber}
          </p>
        </div>
      </footer>

      {modal?.kind === "apply" && <ApplyModal study={modal.study} onClose={closeModal} />}
      {modal?.kind === "study" && <StudyModal existing={modal.existing} onClose={closeModal} />}
      {modal?.kind === "verify" && <VerifyModal onClose={closeModal} />}
      {modal?.kind === "scholar" && <ScholarModal onClose={closeModal} />}
      {modal?.kind === "ror" && (
        <RorModal
          seed={modal.seed}
          onPick={(hit) => {
            modal.onPick(hit);
            closeModal();
          }}
          onClose={closeModal}
        />
      )}
      {modal?.kind === "confirm" && (
        <ConfirmModal title={modal.title} text={modal.text} label={modal.label} onConfirm={modal.onConfirm} onClose={closeModal} />
      )}

      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </UIProvider>
  );
}

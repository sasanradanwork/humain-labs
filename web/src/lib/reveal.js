// Sections rise into place as they come into view.
//
// Two rules this follows. Nothing is hidden until the observer is running, so if the script
// never loads the page still reads normally rather than staying blank. And anyone who asked
// their system for less motion gets the content with no movement at all.

let observer = null;

export function startReveal() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-on");
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        observer.unobserve(e.target);
      }
    },
    // A little before the element arrives, so it has finished moving by the time it is read.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  return observer;
}

// Called whenever the page changes: new nodes are picked up, ones already shown are left alone.
export function scanReveal() {
  if (!observer) return;
  for (const el of document.querySelectorAll("[data-reveal]:not(.is-in)")) observer.observe(el);
}

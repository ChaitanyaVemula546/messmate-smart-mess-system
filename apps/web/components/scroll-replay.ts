// Native viewport observation drives Anime.js without a per-scroll render loop.
// Separate entry/exit boundaries prevent an entrance transform or a tiny scroll
// near the viewport edge from repeatedly restarting the same animation.
export function createScrollReplayObserver(
  onEnter: (element: HTMLElement) => void,
  onLeave: (element: HTMLElement) => void,
) {
  const observed = new Set<HTMLElement>();
  const active = new Set<HTMLElement>();
  const margin = Math.min(40, Math.floor(window.innerHeight / 8));
  const enter = (element: HTMLElement) => {
    if (!observed.has(element) || active.has(element) || document.hidden)
      return;
    active.add(element);
    onEnter(element);
  };
  const leave = (element: HTMLElement) => {
    if (!active.delete(element)) return;
    onLeave(element);
  };
  const entryObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (
          entry.isIntersecting &&
          entry.intersectionRect.height > 0 &&
          entry.intersectionRect.width > 0
        ) {
          enter(entry.target as HTMLElement);
        }
      }
    },
    { rootMargin: `-${margin}px 0px -${margin}px 0px`, threshold: [0, 0.001] },
  );
  const exitObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) leave(entry.target as HTMLElement);
      }
    },
    { rootMargin: `${margin}px 0px ${margin}px 0px` },
  );
  const visibilityChanged = () => {
    if (document.hidden) {
      for (const element of active) leave(element);
    } else {
      // Native observers need not report again when only tab visibility changes.
      for (const element of observed) {
        const box = element.getBoundingClientRect();
        if (
          box.bottom > margin &&
          box.top < window.innerHeight - margin &&
          box.right > 0 &&
          box.left < window.innerWidth &&
          box.width > 0 &&
          box.height > 0
        )
          enter(element);
      }
    }
  };
  document.addEventListener("visibilitychange", visibilityChanged);
  return {
    observe(element: HTMLElement) {
      if (observed.has(element)) return;
      observed.add(element);
      entryObserver.observe(element);
      exitObserver.observe(element);
    },
    unobserve(element: HTMLElement) {
      observed.delete(element);
      entryObserver.unobserve(element);
      exitObserver.unobserve(element);
      leave(element);
    },
    disconnect() {
      entryObserver.disconnect();
      exitObserver.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
      for (const element of active) leave(element);
      observed.clear();
    },
  };
}

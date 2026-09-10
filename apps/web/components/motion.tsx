"use client";

import {
  animate,
  createAnimatable,
  createScope,
  createTimeline,
  stagger,
} from "animejs";
import { usePathname } from "next/navigation";
import { createScrollReplayObserver } from "./scroll-replay";
import {
  Fragment,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(callback: () => void) {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}
export function canAnimate() {
  return !window.matchMedia(reducedQuery).matches && !document.hidden;
}

// Observe existing page sections, including those mounted after API responses.
// Nothing is hidden in CSS or SSR; an unavailable animation never blocks content.
const revealSelector = [
  ".page-heading > div:first-child",
  ".kpi-grid > .card",
  ".dashboard-grid > .card",
  ".meal-grid > *",
  ".settings-grid > .card",
  ".content > .stack > .card",
  ".hero > div:not(.hero-art)",
  ".feature-grid > .feature",
  ".public-section > h2",
  ".public-section > .between",
  ".login-form > form",
  "[data-motion-reveal]",
].join(",");
const groupSelector = ".kpi-grid, .meal-grid, .feature-grid";

export function MotionEffects() {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || window.matchMedia(reducedQuery).matches) return;
    const running = new Map<HTMLElement, ReturnType<typeof createScope>>();
    const pending = new Set<HTMLElement>();
    let frame = 0;
    const stop = (element: HTMLElement) => {
      const scope = running.get(element);
      running.delete(element);
      scope?.revert();
    };
    const reveal = (element: HTMLElement) => {
      if (!element.isConnected || !canAnimate()) return;
      stop(element);
      const parent = element.parentElement;
      const index = parent?.matches(groupSelector)
        ? Array.from(parent.children).indexOf(element)
        : 0;
      const offset =
        element.getBoundingClientRect().top < window.innerHeight / 2 ? -26 : 26;
      const scope = createScope({ root: element });
      running.set(element, scope);
      scope.add(() => {
        const timeline = createTimeline({
          onComplete: () => stop(element),
        });
        timeline.add(
          element,
          {
            opacity: [0.3, 1],
            y: [offset, 0],
            scale: [0.975, 1],
            delay: Math.min(index, 5) * 75,
            duration: 620,
            ease: "out(4)",
          },
          0,
        );
        const words = element.querySelectorAll(".motion-word");
        if (words.length)
          timeline.add(
            words,
            {
              y: ["105%", "0%"],
              rotate: [4, 0],
              opacity: [0, 1],
              delay: stagger(36),
              duration: 700,
              ease: "out(4)",
            },
            60,
          );
        const accents = element.querySelectorAll(".kpi-accent");
        if (accents.length)
          timeline.add(
            accents,
            {
              scaleX: [0, 1],
              delay: stagger(75),
              duration: 680,
              ease: "outExpo",
            },
            170,
          );
      });
    };
    const observer = createScrollReplayObserver(reveal, stop);
    const collect = (root: HTMLElement) => {
      if (root.matches(revealSelector)) pending.add(root);
      root
        .querySelectorAll<HTMLElement>(revealSelector)
        .forEach((node) => pending.add(node));
      if (!frame) {
        frame = requestAnimationFrame(() => {
          pending.forEach((node) => {
            if (node.isConnected) observer.observe(node);
          });
          pending.clear();
          frame = 0;
        });
      }
    };
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          // Ignore SVG/chart updates and count-up text-node changes.
          if (node instanceof HTMLElement) collect(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof HTMLElement) {
            observer.unobserve(node);
            node
              .querySelectorAll<HTMLElement>(revealSelector)
              .forEach((child) => observer.unobserve(child));
          }
        }
      }
    });
    collect(document.body);
    mutations.observe(document.body, { childList: true, subtree: true });

    // Delegation also covers existing Link buttons and Radix dialog portals.
    // Keep only currently running interactions, not an ever-growing history.
    const interactions = new Map<HTMLElement, ReturnType<typeof animate>>();
    const targetFor = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(".btn, .sidebar nav a, .meal-tab")
        : null;
    const interact = (event: Event) => {
      const target = targetFor(event.target);
      if (
        !target ||
        !canAnimate() ||
        target.matches(":disabled, [aria-disabled='true']")
      )
        return;
      if (event instanceof PointerEvent) {
        if (
          event.type === "pointerover" &&
          (event.pointerType === "touch" ||
            targetFor(event.relatedTarget) === target)
        )
          return;
        if (
          event.type === "pointerout" &&
          targetFor(event.relatedTarget) === target
        )
          return;
      }
      interactions.get(target)?.revert();
      const pressed = event.type === "pointerdown";
      const hovering = event.type === "pointerover" || event.type === "focusin";
      const animation = animate(target, {
        y: hovering ? [0, -3, 0] : 0,
        scale: pressed ? [1, 0.965] : [0.985, 1],
        "--button-shine": hovering ? [-140, 240] : -140,
        duration: hovering ? 480 : 180,
        ease: "out(3)",
        onComplete: (instance) => {
          if (interactions.get(target) === instance) {
            instance.revert();
            interactions.delete(target);
          }
        },
      });
      interactions.set(target, animation);
    };
    const events = [
      "pointerover",
      "pointerout",
      "pointerdown",
      "pointerup",
      "pointercancel",
      "focusin",
      "focusout",
    ];
    events.forEach((event) =>
      document.addEventListener(event, interact, { passive: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
      events.forEach((event) => document.removeEventListener(event, interact));
      interactions.forEach((animation) => animation.revert());
      interactions.clear();
      running.forEach((scope) => scope.revert());
      running.clear();
    };
  }, [pathname, reduced]);
  return null;
}

export function useEntrance<T extends HTMLElement>(
  key: string | number | boolean,
  kind:
    "rows" | "panel" | "success" | "error" | "navigation" | "dialog" = "panel",
) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || window.matchMedia(reducedQuery).matches) return;
    if (kind === "rows") {
      const running = new Map<HTMLElement, ReturnType<typeof animate>>();
      const rows = Array.from(element.children).slice(0, 16) as HTMLElement[];
      const stop = (row: HTMLElement) => {
        const animation = running.get(row);
        running.delete(row);
        animation?.revert();
      };
      const observer = createScrollReplayObserver((row) => {
        if (!canAnimate()) return;
        stop(row);
        running.set(
          row,
          animate(row, {
            opacity: [0.3, 1],
            y: [
              row.getBoundingClientRect().top < window.innerHeight / 2
                ? -12
                : 12,
              0,
            ],
            delay: (rows.indexOf(row) % 6) * 26,
            duration: 420,
            ease: "outCubic",
            onComplete: () => stop(row),
          }),
        );
      }, stop);
      rows.forEach((row) => observer.observe(row));
      return () => {
        observer.disconnect();
        running.forEach((animation) => animation.revert());
        running.clear();
      };
    }
    if (!canAnimate()) return;
    const scope = createScope({ root: element }).add(() => {
      if (kind === "navigation") {
        animate(
          Array.from(element.children)
            .filter((child) => child.matches("a"))
            .slice(0, 12),
          {
            opacity: [0.3, 1],
            y: 0,
            x: [-14, 0],
            delay: stagger(34),
            duration: 420,
            ease: "outCubic",
            onComplete: (animation) => animation.revert(),
          },
        );
      } else {
        animate(element, {
          opacity: kind === "error" ? 1 : [0.4, 1],
          ...(kind === "dialog"
            ? { scale: [0.95, 1] }
            : {
                x: kind === "error" ? [0, -6, 6, -4, 3, 0] : 0,
                y: kind === "error" ? 0 : [14, 0],
              }),
          duration: kind === "error" ? 380 : 450,
          ease: "outCubic",
          onComplete: (animation) => animation.revert(),
        });
        if (kind === "success") {
          const icon = element.querySelector("[data-success-icon]");
          if (icon)
            animate(icon, {
              scale: [0.5, 1.18, 1],
              rotate: [-18, 0],
              duration: 550,
              ease: "outCubic",
              onComplete: (animation) => animation.revert(),
            });
        }
      }
    });
    return () => scope.revert();
  }, [key, kind, reduced]);
  return ref;
}

export function AnimatedNumber({
  value,
  digits = 0,
  prefix = "",
  suffix = "",
  fallback = "Not configured",
  finalText,
}: {
  value: number | null | undefined;
  digits?: number;
  prefix?: string;
  suffix?: string;
  fallback?: string;
  finalText?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(0);
  const reduced = useReducedMotion();
  const valid = typeof value === "number" && Number.isFinite(value);
  const formatted = valid
    ? (finalText ??
      prefix +
        new Intl.NumberFormat("en-IN", {
          maximumFractionDigits: digits,
        }).format(value) +
        suffix)
    : fallback;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!valid || reduced || window.matchMedia(reducedQuery).matches) {
      element.textContent = formatted;
      current.current = valid ? value : 0;
      return;
    }
    const formatter = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: digits,
    });
    let animation: ReturnType<typeof animate> | undefined;
    let firstEntry = true;
    const stop = () => {
      animation?.cancel();
      current.current = value;
      element.textContent = formatted;
    };
    const start = () => {
      if (!canAnimate()) return;
      animation?.cancel();
      const model = { value: firstEntry ? current.current : 0 };
      firstEntry = false;
      if (model.value === value) {
        stop();
        return;
      }
      element.textContent = prefix + formatter.format(model.value) + suffix;
      animation = animate(model, {
        value,
        duration: 950,
        ease: "outCubic",
        onUpdate: () => {
          current.current = model.value;
          element.textContent = prefix + formatter.format(model.value) + suffix;
        },
        onComplete: () => {
          current.current = value;
          element.textContent = formatted;
        },
      });
    };
    const observer = createScrollReplayObserver(start, stop);
    observer.observe(element);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [value, valid, digits, prefix, suffix, formatted, reduced]);
  return (
    <span
      className="animated-number"
      data-count-target={valid ? value : undefined}
    >
      <span className="sr-only">{formatted}</span>
      <span aria-hidden="true" ref={ref}>
        {formatted}
      </span>
    </span>
  );
}

// Existing KPI formatting and unavailable placeholders remain the source of truth.
export function AnimatedMetric({ value }: { value: ReactNode }) {
  if (typeof value === "number")
    return (
      <AnimatedNumber value={value} digits={Number.isInteger(value) ? 0 : 3} />
    );
  if (typeof value !== "string") return value;
  const match = /^(₹?)(-?[\d,]+(?:\.\d+)?)(\s*(?:%|kg|kg CO₂e|litres)?)$/.exec(
    value,
  );
  if (!match) return value;
  const parsed = Number(match[2].replaceAll(",", ""));
  if (!Number.isFinite(parsed)) return value;
  return (
    <AnimatedNumber
      value={parsed}
      digits={match[2].split(".")[1]?.length ?? 0}
      prefix={match[1]}
      suffix={match[3]}
      finalText={value}
    />
  );
}

// Keep complete text available to assistive technology; only the visual copy is split.
export function MotionWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span className="motion-words">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <Fragment key={index}>
            <span className="motion-word-clip">
              <span className="motion-word">{word}</span>
            </span>
            {index < words.length - 1 ? " " : ""}
          </Fragment>
        ))}
      </span>
    </span>
  );
}

// The active item remains the semantic source of truth. The moving background
// is purely decorative, with the original selected styling as a no-JS fallback.
export function useSelectionIndicator(
  ref: RefObject<HTMLElement | null>,
  key: string,
  selector: string,
) {
  const reduced = useReducedMotion();
  const positioned = useRef(false);
  useEffect(() => {
    const root = ref.current;
    const indicator = root?.querySelector<HTMLElement>(".selection-indicator");
    if (!root || !indicator) return;
    let animation: ReturnType<typeof animate> | undefined;
    const place = (motion: boolean) => {
      const selected = root.querySelector<HTMLElement>(selector);
      if (!selected) {
        root.removeAttribute("data-indicator-ready");
        return;
      }
      animation?.cancel();
      const next = {
        x: selected.offsetLeft,
        y: selected.offsetTop,
        width: selected.offsetWidth,
        height: selected.offsetHeight,
      };
      if (motion && positioned.current && !reduced && canAnimate()) {
        animation = animate(indicator, {
          ...next,
          duration: 460,
          ease: "out(4)",
        });
      } else {
        indicator.style.transform = `translate(${next.x}px, ${next.y}px)`;
        indicator.style.width = `${next.width}px`;
        indicator.style.height = `${next.height}px`;
      }
      positioned.current = true;
      root.setAttribute("data-indicator-ready", "true");
    };
    place(true);
    let lastWidth = root.clientWidth;
    let lastHeight = root.clientHeight;
    const observer = new ResizeObserver(() => {
      if (root.clientWidth !== lastWidth || root.clientHeight !== lastHeight) {
        lastWidth = root.clientWidth;
        lastHeight = root.clientHeight;
        place(false);
      }
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [key, selector, ref, reduced]);
}

export function usePointerSurface() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const card = ref.current;
    const surface = card?.querySelector<HTMLElement>(".kpi-surface");
    if (
      !card ||
      !surface ||
      reduced ||
      !canAnimate() ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    const tilt = createAnimatable(surface, {
      rotateX: 400,
      rotateY: 400,
      ease: "out(3)",
    });
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !canAnimate()) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        const x = Math.max(
          0,
          Math.min(1, (event.clientX - box.left) / box.width),
        );
        const y = Math.max(
          0,
          Math.min(1, (event.clientY - box.top) / box.height),
        );
        card.style.setProperty("--spot-x", `${x * 100}%`);
        card.style.setProperty("--spot-y", `${y * 100}%`);
        tilt.rotateX((0.5 - y) * 7);
        tilt.rotateY((x - 0.5) * 7);
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      tilt.rotateX(0);
      tilt.rotateY(0);
    };
    card.addEventListener("pointermove", move, { passive: true });
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    return () => {
      cancelAnimationFrame(frame);
      tilt.revert();
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", reset);
      card.removeEventListener("pointercancel", reset);
      card.style.removeProperty("--spot-x");
      card.style.removeProperty("--spot-y");
    };
  }, [reduced]);
  return ref;
}

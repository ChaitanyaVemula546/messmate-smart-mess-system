"use client";

import { animate, createDrawable, createScope, stagger } from "animejs";
import { useEffect, useRef } from "react";
import { canAnimate, useReducedMotion } from "./motion";
import { createScrollReplayObserver } from "./scroll-replay";

// Animate the shapes Recharts already calculated. Values, axes, tooltips and
// hit targets remain owned by Recharts. Scroll entry replays; unchanged polling
// while the chart stays visible does not restart the animation.
export function useChartEntrance(dataKey: string, horizontal = false) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const root = ref.current;
    if (
      !root ||
      reduced ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let scope: ReturnType<typeof createScope> | undefined;
    let visible = false;
    let played = false;
    let frame = 0;
    const start = () => {
      if (!visible || played || !canAnimate()) return;
      const curves = root.querySelectorAll<SVGPathElement>(
        ".recharts-line-curve, .recharts-area-curve",
      );
      const bars = Array.from(
        root.querySelectorAll<SVGPathElement>(
          ".recharts-bar-rectangle .recharts-rectangle",
        ),
      ).slice(0, 80);
      if (!curves.length && !bars.length) return;
      played = true;
      mutations.disconnect();
      scope?.revert();
      scope = createScope({ root }).add(() => {
        if (curves.length)
          animate(createDrawable(curves, 0, 1), {
            draw: ["0 0", "0 1"],
            duration: 1100,
            delay: stagger(100),
            ease: "inOut(3)",
            onComplete: (animation) => animation.revert(),
          });
        if (bars.length)
          animate(bars, {
            ...(horizontal ? { scaleX: [0.02, 1] } : { scaleY: [0.02, 1] }),
            opacity: [0.35, 1],
            delay: stagger(22),
            duration: 740,
            ease: "out(4)",
            onComplete: (animation) => animation.revert(),
          });
        const fills = root.querySelectorAll(".recharts-area-area");
        if (fills.length)
          animate(fills, {
            opacity: [0, 1],
            duration: 900,
            delay: 220,
            ease: "out(3)",
            onComplete: (animation) => animation.revert(),
          });
      });
    };
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(start);
    });
    const stop = () => {
      visible = false;
      played = false;
      cancelAnimationFrame(frame);
      mutations.disconnect();
      scope?.revert();
      scope = undefined;
    };
    const observer = createScrollReplayObserver(() => {
      visible = true;
      mutations.observe(root, { childList: true, subtree: true });
      start();
    }, stop);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
      stop();
    };
  }, [dataKey, horizontal, reduced]);
  return ref;
}

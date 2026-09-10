"use client";

import {
  createDrawable,
  createMotionPath,
  createScope,
  createTimeline,
  stagger,
} from "animejs";
import { useEffect, useRef, useState } from "react";
import {
  CalendarCheck,
  Fingerprint,
  Scale,
  Leaf,
  RotateCcw,
} from "lucide-react";
import { canAnimate, useReducedMotion } from "./motion";
import { createScrollReplayObserver } from "./scroll-replay";

const steps = [
  {
    Icon: CalendarCheck,
    number: "01",
    title: "Plan the meal",
    body: "Students share their plans.",
  },
  {
    Icon: Fingerprint,
    number: "02",
    title: "Know who arrived",
    body: "Fingerprint check-ins verify attendance.",
  },
  {
    Icon: Scale,
    number: "03",
    title: "Measure what remains",
    body: "The waste station closes the loop.",
  },
];

// An explanatory illustration only. It has no connection to attendance state.
export function MealJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      reduced ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let scope: ReturnType<typeof createScope> | undefined;
    const stop = () => {
      scope?.revert();
      scope = undefined;
    };
    const play = () => {
      if (!canAnimate()) return;
      stop();
      scope = createScope({ root: element }).add(() => {
        const route = element.querySelector<SVGPathElement>(".journey-route")!;
        const timeline = createTimeline({
          onComplete: (instance) => instance.revert(),
        });
        timeline
          .add(
            ".journey-dot",
            {
              scale: [0.25, 1.7, 1],
              opacity: [0.12, 0.85, 0.35],
              delay: stagger(35, { grid: [8, 5], from: "center" }),
              duration: 1100,
              ease: "out(3)",
            },
            0,
          )
          .add(
            ".journey-orbit",
            {
              rotate: [-24, 0],
              scale: [0.85, 1],
              opacity: [0, 1],
              duration: 1500,
              ease: "out(4)",
            },
            0,
          )
          .add(
            createDrawable(route, 0, 1),
            { draw: ["0 0", "0 1"], duration: 1750, ease: "inOut(3)" },
            250,
          )
          .add(
            ".flow-tile",
            {
              x: [38, 0],
              y: [12, 0],
              rotate: [-3, 0],
              opacity: [0.15, 1],
              delay: stagger(160),
              duration: 850,
              ease: "out(4)",
            },
            160,
          )
          .add(
            createDrawable(
              element.querySelectorAll(
                ".journey-icon path, .journey-icon polyline, .journey-icon line",
              ),
              0,
              1,
            ),
            {
              draw: ["0 0", "0 1"],
              delay: stagger(25),
              duration: 650,
              ease: "inOut(3)",
            },
            450,
          )
          .add(
            ".journey-icon",
            {
              scale: [1, 1.16, 1],
              delay: stagger(380),
              duration: 800,
              ease: "inOut(3)",
            },
            1100,
          )
          .add(
            ".journey-traveller",
            {
              ...createMotionPath(route),
              opacity: [0, 1, 1, 0],
              duration: 2400,
              ease: "inOut(2)",
            },
            1300,
          );
      });
    };
    const observer = createScrollReplayObserver(play, stop);
    observer.observe(element);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [replay, reduced]);
  return (
    <div
      ref={ref}
      className="hero-art journey-art"
      aria-label="How meal planning, attendance and measured waste connect"
    >
      <div className="journey-heading">
        <span className="eyebrow">A better meal starts with a plan</span>
        <button
          type="button"
          className="journey-replay"
          aria-label="Replay meal illustration"
          title={
            reduced
              ? "Motion is reduced in your device settings"
              : "Replay illustration"
          }
          disabled={reduced}
          onClick={() => setReplay((value) => value + 1)}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="journey-stage">
        <svg
          className="journey-circuit"
          viewBox="0 0 440 380"
          fill="none"
          aria-hidden="true"
        >
          <g className="journey-orbit">
            <circle
              cx="250"
              cy="195"
              r="146"
              stroke="#c7dfaa"
              strokeOpacity="0.18"
            />
            <circle
              cx="250"
              cy="195"
              r="168"
              stroke="#c7dfaa"
              strokeOpacity="0.1"
              strokeDasharray="3 9"
            />
          </g>
          <path
            className="journey-route"
            d="M30 60 C30 60 405 35 407 104 S20 123 27 180 S407 223 408 280 S36 338 25 352"
            stroke="#c9e49b"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
          <circle className="journey-traveller" r="4" fill="#efffcf" />
          <g>
            {Array.from({ length: 40 }, (_, i) => (
              <circle
                className="journey-dot"
                key={i}
                cx={280 + (i % 8) * 17}
                cy={275 + Math.floor(i / 8) * 17}
                r="2"
                fill="#c9e49b"
                opacity="0.35"
              />
            ))}
          </g>
        </svg>
        <div className="journey-tiles">
          {steps.map(({ Icon, number, title, body }) => (
            <div className="flow-tile" key={number}>
              <span className="number">{number}</span>
              <div>
                <strong>{title}</strong>
                <small>{body}</small>
              </div>
              <span className="journey-icon">
                <Icon size={25} aria-hidden="true" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="journey-caption">
        <Leaf size={15} aria-hidden="true" />
        <span>Better information. More considered cooking.</span>
      </div>
    </div>
  );
}

"use client";

import { useRef, type KeyboardEvent } from "react";
import { Coffee, Sun, Moon } from "lucide-react";
import { useEntrance, useSelectionIndicator } from "./motion";

const meals = [
  { value: "BREAKFAST", label: "Breakfast", Icon: Coffee },
  { value: "LUNCH", label: "Lunch", Icon: Sun },
  { value: "DINNER", label: "Dinner", Icon: Moon },
];

export function MealTabs({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (meal: string) => void;
  id: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsRef = useRef<HTMLDivElement>(null);
  useSelectionIndicator(tabsRef, value, '[aria-selected="true"]');
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % meals.length;
    else if (event.key === "ArrowLeft")
      next = (index + meals.length - 1) % meals.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = meals.length - 1;
    else return;
    event.preventDefault();
    onChange(meals[next].value);
    buttons.current[next]?.focus();
  };
  return (
    <div className="meal-tabs" role="tablist" aria-label="Meal" ref={tabsRef}>
      <span className="selection-indicator" aria-hidden="true" />
      {meals.map(({ value: meal, label, Icon }, index) => (
        <button
          key={meal}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          className="meal-tab"
          role="tab"
          type="button"
          id={`${id}-${meal}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === meal}
          tabIndex={value === meal ? 0 : -1}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => onChange(meal)}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function MealPanel({
  meal,
  id,
  children,
}: {
  meal: string;
  id: string;
  children: React.ReactNode;
}) {
  const ref = useEntrance<HTMLDivElement>(meal);
  return (
    <div
      className="stack meal-panel"
      ref={ref}
      role="tabpanel"
      tabIndex={0}
      id={`${id}-panel`}
      aria-labelledby={`${id}-${meal}`}
    >
      {children}
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";
import { suggest } from "@/lib/suggest";

type Props = {
  name: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  /** Called when a suggestion is picked or Enter is pressed. */
  onCommit?: (v: string) => void;
  placeholder: string;
  /** Example searches typed into the empty field until the person interacts. */
  hints?: string[];
  className?: string;
  inputClassName?: string;
};

/** Accessible combobox (WAI-ARIA 1.2 list autocomplete) with optional typed hints. */
export function SearchCombobox({ name, label, value, onValueChange, onCommit, placeholder, hints, className = "", inputClassName = "" }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = open ? suggest(value) : [];
  const hint = useTypedHint(hints, value === "");

  function pick(v: string) {
    onValueChange(v);
    setOpen(false);
    setActive(-1);
    onCommit?.(v);
  }

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" strokeWidth={1.75} />
      <input
        id={id}
        name={name}
        type="search"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        spellCheck={false}
        value={value}
        placeholder={hint.on ? "" : placeholder}
        onFocus={() => {
          hint.stop();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          hint.stop();
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && options.length) {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp" && options.length) {
            e.preventDefault();
            setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
          } else if (e.key === "Enter") {
            if (active >= 0 && options[active]) {
              e.preventDefault();
              pick(options[active]);
            } else {
              setOpen(false);
              onCommit?.(value);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        className={`h-14 w-full rounded-full border border-line bg-surface ps-12 pe-4 text-[1.02rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)] [&::-webkit-search-cancel-button]:hidden ${inputClassName}`}
      />
      {hint.on && (
        <span aria-hidden="true" className="pointer-events-none absolute start-12 end-4 top-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap text-[1.02rem] text-muted">
          {hint.text}
          <span className="caret ms-px inline-block h-5 w-px translate-y-1 bg-ink" />
        </span>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label={t("hero.suggestions")}
        hidden={options.length === 0}
        className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-[0_12px_32px_-16px_rgba(14,31,47,0.35)]"
      >
        {options.map((opt, i) => (
          <li
            key={opt}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(opt);
            }}
            onMouseEnter={() => setActive(i)}
            className={`cursor-pointer px-4 py-2.5 text-[0.98rem] ${i === active ? "bg-ink-soft" : ""}`}
          >
            {opt}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Types example searches letter by letter. Stops for good on interaction, reduced motion, or hidden tab. */
function useTypedHint(hints: string[] | undefined, empty: boolean) {
  const [text, setText] = useState("");
  const [stopped, setStopped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hints?.length || stopped || !empty) return;
    // Reduced motion: never start, so the static placeholder shows instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let word = 0;
    let len = 0;
    let deleting = false;
    const tick = () => {
      if (document.hidden) {
        timer.current = setTimeout(tick, 600);
        return;
      }
      const full = hints[word % hints.length];
      len += deleting ? -1 : 1;
      setText(full.slice(0, len));
      let delay = deleting ? 35 : 70;
      if (!deleting && len === full.length) {
        deleting = true;
        delay = 1600;
      } else if (deleting && len === 0) {
        deleting = false;
        word += 1;
        delay = 350;
      }
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hints, stopped, empty]);

  return {
    on: Boolean(hints?.length) && !stopped && empty && text.length > 0,
    text,
    stop: () => setStopped(true),
  };
}

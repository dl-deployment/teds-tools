"use client";

import { useState } from "react";
import { groupNumber } from "@/lib/poe";

const fieldClass =
  "flex-shrink-0 bg-bg border border-border text-text px-1.5 py-1 rounded-lg text-[12.5px] font-mono placeholder:font-sans placeholder:text-muted/60";

/**
 * A numeric box for an editable number. The value is committed on blur or
 * Enter rather than on every keystroke, so typing "100" writes once instead of
 * also saving "1" and "10" on the way there. `null` shows as empty — "not set"
 * rather than 0.
 *
 * `group` switches the box to thousands-grouped display, which a
 * `type="number"` input cannot do: the field becomes a text box that shows the
 * grouped figure at rest and the plain digits while you are typing in it, since
 * commas in the middle of an edit are only in the way.
 *
 * Shared by the Trade tab's min/max bounds and the Exchange tab's costs, rates
 * and amounts; callers set the width and alignment through `className`.
 */
export default function NumberField({
  value,
  placeholder,
  dimmed,
  group,
  align = "center",
  className = "",
  onCommit,
}) {
  // What is on screen while the box is being edited, or null when it isn't —
  // at rest the box shows the value the prop carries, however it is formatted.
  const [draft, setDraft] = useState(null);

  const atRest = value == null ? "" : group ? groupNumber(value) : String(value);
  const text = draft === null ? atRest : draft;

  return (
    <input
      type={group ? "text" : "number"}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setDraft(value == null ? "" : String(value))}
      onBlur={() => {
        setDraft(null);
        onCommit(text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`${fieldClass} ${align === "right" ? "text-right" : "text-center"} ${
        dimmed ? "opacity-50" : ""
      } ${className}`}
    />
  );
}

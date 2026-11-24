"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

const LENGTH = 6;

/**
 * The reference's one-box-per-digit code input (6 digits here). Typing moves to the next box,
 * Backspace goes back, and pasting a whole code fills every box. Submits as `name`.
 */
export function OtpInput({ name = "code" }: { name?: string }) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  /** Writes `code` from box `index` onward (one digit typed, or a whole code autofilled). */
  function fill(index: number, code: string) {
    setDigits((current) => {
      const next = [...current];
      for (let i = 0; i < code.length && index + i < LENGTH; i++) next[index + i] = code[i];
      return next;
    });
    boxes.current[Math.min(index + code.length, LENGTH - 1)]?.focus();
  }

  function onInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) {
      setDigits((current) => current.map((d, i) => (i === index ? "" : d)));
      return;
    }
    // A box that already held a digit gets the new one as its last character.
    fill(index, typed.length === 2 && digits[index] ? typed.slice(-1) : typed);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!code) return;
    event.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, i) => code[i] ?? ""));
    boxes.current[Math.min(code.length, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex w-full justify-center gap-1.5 sm:gap-2" dir="ltr">
      <input type="hidden" name={name} value={digits.join("")} />
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={i === 0}
          aria-label={`الرقم ${i + 1} من ${LENGTH}`}
          className="h-12 w-full min-w-0 max-w-12 flex-1 rounded-2xl border-2 border-line bg-canvas text-center font-display text-xl font-black text-ink outline-none transition focus:border-primary focus:bg-surface sm:h-14 sm:text-2xl"
        />
      ))}
    </div>
  );
}

import type { ComponentProps } from "react";

/** Shared look of every text control (Input, Select, Textarea). */
export const controlClasses =
  "w-full rounded-2xl border border-line bg-canvas px-4 text-sm font-bold text-ink outline-none transition placeholder:font-semibold placeholder:text-muted/70 focus:border-primary focus:bg-surface";

export function Input({
  label,
  hint,
  id,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-black text-ink">{label}</span>
      <input id={id} className={`h-12 ${controlClasses} ${className}`} {...props} />
      {hint ? <span className="mt-1 block text-[11px] font-semibold text-muted">{hint}</span> : null}
    </label>
  );
}

import type { ComponentProps, ReactNode } from "react";
import { controlClasses } from "@/components/ui/Input";

// Select, Textarea and Switch share the look of Input (components/ui/Input.tsx).

function Label({ htmlFor, label, children }: { htmlFor?: string; label: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-xs font-black text-ink">{label}</span>
      {children}
    </label>
  );
}

export function Select({
  label,
  id,
  options,
  placeholder = "اختر…",
  ...props
}: ComponentProps<"select"> & {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Label htmlFor={id} label={label}>
      <select id={id} className={`h-12 ${controlClasses}`} {...props}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

export function Textarea({ label, id, ...props }: ComponentProps<"textarea"> & { label: string }) {
  return (
    <Label htmlFor={id} label={label}>
      <textarea id={id} className={`min-h-24 py-3 leading-7 ${controlClasses}`} {...props} />
    </Label>
  );
}

/** An accessible on/off switch built on a checkbox (submits "on" when checked). */
export function Switch({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-black text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs font-semibold text-muted">{description}</span>
        ) : null}
      </span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
        <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring peer-checked:-translate-x-5" />
      </span>
    </label>
  );
}

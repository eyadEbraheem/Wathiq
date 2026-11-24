import type { ComponentProps } from "react";

/** White (dark: navy) rounded card with the soft reference shadow. */
export function Card({ className = "", ...props }: ComponentProps<"article">) {
  return (
    <article
      className={`rounded-card border border-line/80 bg-surface shadow-soft ${className}`}
      {...props}
    />
  );
}

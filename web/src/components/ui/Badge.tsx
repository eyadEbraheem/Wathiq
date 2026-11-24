import type { SectionSlug } from "@csh/shared";
import type { ReactNode } from "react";

export type Tone = SectionSlug | "primary" | "neutral" | "success" | "danger";

const TONES: Record<Tone, string> = {
  humanitarian: "bg-humanitarian/10 text-humanitarian-ink",
  environment: "bg-environment/10 text-environment-ink",
  "animal-welfare": "bg-animal-welfare/10 text-animal-welfare-ink",
  community: "bg-community/15 text-community-ink",
  education: "bg-education/10 text-education-ink",
  primary: "bg-icy text-primary-ink",
  neutral: "bg-canvas text-muted border border-line",
  success: "bg-environment/10 text-environment-ink",
  danger: "bg-humanitarian/10 text-humanitarian-ink",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

import type { SectionSlug } from "@csh/shared";
import type { IconName } from "@/components/ui/Icon";

/**
 * How each section looks. Class names are written out in full so Tailwind keeps them.
 * Colors come from @csh/shared (theme.ts) through tailwind.config.js.
 */
export interface SectionLook {
  icon: IconName;
  /** Solid icon tile. */
  solid: string;
  /** Text in the section color. */
  text: string;
  /** Soft tinted surface with a matching border (unselected tree node, chip). */
  soft: string;
  /** Chosen state (selected tree node). */
  chosen: string;
  /** Raw CSS color for SVG strokes. */
  stroke: string;
}

const LOOKS: Record<SectionSlug, SectionLook> = {
  humanitarian: {
    icon: "heart",
    solid: "bg-humanitarian text-white",
    text: "text-humanitarian-ink",
    soft: "bg-humanitarian/10 border-humanitarian/25 hover:border-humanitarian",
    chosen: "bg-humanitarian/15 border-humanitarian",
    stroke: "rgb(var(--c-humanitarian))",
  },
  environment: {
    icon: "leaf",
    solid: "bg-environment text-white",
    text: "text-environment-ink",
    soft: "bg-environment/10 border-environment/25 hover:border-environment",
    chosen: "bg-environment/15 border-environment",
    stroke: "rgb(var(--c-environment))",
  },
  "animal-welfare": {
    icon: "paw",
    solid: "bg-animal-welfare text-white",
    text: "text-animal-welfare-ink",
    soft: "bg-animal-welfare/10 border-animal-welfare/25 hover:border-animal-welfare",
    chosen: "bg-animal-welfare/15 border-animal-welfare",
    stroke: "rgb(var(--c-animal-welfare))",
  },
  community: {
    icon: "users",
    solid: "bg-community text-white",
    text: "text-community-ink",
    soft: "bg-community/10 border-community/25 hover:border-community",
    chosen: "bg-community/15 border-community",
    stroke: "rgb(var(--c-community))",
  },
  education: {
    icon: "school",
    solid: "bg-education text-white",
    text: "text-education-ink",
    soft: "bg-education/10 border-education/25 hover:border-education",
    chosen: "bg-education/15 border-education",
    stroke: "rgb(var(--c-education))",
  },
};

/** The look of a section; unknown slugs fall back to the primary teal. */
export function sectionLook(slug: string): SectionLook {
  return (
    LOOKS[slug as SectionSlug] ?? {
      icon: "grid",
      solid: "bg-primary text-white",
      text: "text-primary-ink",
      soft: "bg-primary/10 border-primary/25 hover:border-primary",
      chosen: "bg-primary/15 border-primary",
      stroke: "rgb(var(--c-primary))",
    }
  );
}

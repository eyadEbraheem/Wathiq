import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { sectionLook } from "@/lib/sections";
import type { Section } from "@/lib/types";

/**
 * The reference's horizontal "tree": a root node with curved branches to each section. The
 * chosen section's branch flows; its topics show as chips below. Other pages (the accounts
 * directory) pass their own root label, a line under each section, and an "all" link.
 */
export function SectionTree({
  sections,
  activeId,
  topicId,
  link,
  rootLabel = "أقسام واثق",
  rootCount,
  subtitle = (s) => `${s.topics.length} مواضيع`,
  allHref,
  showTopics = true,
}: {
  sections: Section[];
  /** 0 = no section chosen (only with `allHref`). */
  activeId: number;
  topicId?: number;
  link: (q: { section?: number; topic?: number | null }) => string;
  rootLabel?: string;
  /** The badge in the root node; defaults to the number of sections. */
  rootCount?: string;
  subtitle?: (s: Section) => string;
  /** When set, the root node links here and shows as chosen while no section is. */
  allHref?: string;
  showTopics?: boolean;
}) {
  const active = sections.find((s) => s.id === activeId);
  const n = sections.length || 1;
  // Node centers on a 1000-wide canvas; the grid is RTL, so the first node is on the right.
  const xs = sections.map((_, i) => 1000 - (1000 / n) * (i + 0.5));

  return (
    <div className="rounded-panel border border-line/80 bg-surface p-5 shadow-soft sm:p-7">
      <div className="flex flex-col items-center">
        {allHref ? (
          <Link
            href={allHref}
            prefetch
            aria-current={activeId === 0 ? "true" : undefined}
            className={`organic flipped flex items-center gap-2.5 px-6 py-2.5 shadow-glow ${
              activeId === 0 ? "bg-teal-grad text-white" : "border-2 border-primary/40 bg-surface text-primary-ink"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${activeId === 0 ? "animate-pulse bg-white" : "bg-primary"}`} />
            <span className="text-sm font-black">{rootLabel}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${activeId === 0 ? "bg-white/20" : "bg-icy"}`}>
              {rootCount ?? `${sections.length} أقسام`}
            </span>
          </Link>
        ) : (
          <span className="organic flipped flex items-center gap-2.5 bg-teal-grad px-6 py-2.5 text-white shadow-glow">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            <span className="text-sm font-black">{rootLabel}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
              {rootCount ?? `${sections.length} أقسام`}
            </span>
          </span>
        )}

        <div className="-my-0.5 hidden w-full px-4 md:block md:px-8">
          <svg viewBox="0 0 1000 74" className="h-[74px] w-full overflow-visible" aria-hidden="true">
            {sections.map((s, i) => {
              const on = s.id === activeId;
              return (
                <path
                  key={s.id}
                  className={`tree-branch ${on ? "active" : ""}`}
                  d={`M 500 0 C 500 40, ${xs[i]} 22, ${xs[i]} 74`}
                  stroke={sectionLook(s.slug).stroke}
                  strokeWidth={on ? 4.4 : 2.6}
                  opacity={on ? 1 : 0.5}
                />
              );
            })}
            <circle cx="500" cy="2" r="5.5" fill="rgb(var(--c-primary))" />
          </svg>
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:gap-4 md:mt-0 md:grid-cols-5">
          {sections.map((s) => {
            const look = sectionLook(s.slug);
            const on = s.id === activeId;
            return (
              <Link
                key={s.id}
                href={link({ section: s.id, topic: null })}
                // Load each section ahead of time, so switching sections is instant.
                prefetch
                aria-current={on ? "true" : undefined}
                className={`organic flex items-center gap-3 border-2 p-3.5 text-right text-ink ${
                  on ? `flipped shadow-soft ${look.chosen}` : look.soft
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${look.solid}`}
                >
                  <Icon name={look.icon} className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black leading-tight">{s.nameAr}</span>
                  <span className={`block truncate text-[10px] font-bold ${look.text}`}>
                    {subtitle(s)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {showTopics && active && active.topics.length > 0 ? (
          <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2 border-t border-line/70 pt-4">
            <Link
              href={link({ topic: null })}
              className={`organic organic-sm px-4 py-1.5 text-xs font-black ${
                !topicId ? "bg-navy-grad text-white shadow-sm" : "bg-canvas text-muted hover:text-ink"
              }`}
            >
              كل المواضيع
            </Link>
            {active.topics.map((t) => (
              <Link
                key={t.id}
                href={link({ topic: t.id })}
                className={`organic organic-sm px-4 py-1.5 text-xs font-extrabold ${
                  topicId === t.id
                    ? "flipped bg-teal-grad text-white shadow-glow"
                    : "bg-icy/70 text-ink hover:bg-icy"
                }`}
              >
                {t.nameAr}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

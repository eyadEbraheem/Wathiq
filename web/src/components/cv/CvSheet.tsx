import Link from "next/link";
import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Card } from "@/components/ui/Card";
import { formatDay } from "@/lib/format";
import { badgeHref } from "@/lib/links";
import type { VolunteerCv } from "@/lib/types";

/** What the hours number means: the organizer's hours per event, not a personal time sheet. */
export const HOURS_NOTE =
  "ساعات التطوع هي مجموع ساعات الفعاليات المكتملة التي شارك فيها المتطوع، وفق ساعات الفعالية التي سجّلها المنظّم.";

const yearRange = (start: number | null, end: number | null) =>
  start ? `${start} – ${end ?? "حتى الآن"}` : "";

/**
 * The volunteer CV as an A4 sheet. Used by the owner's /cv page and by the public shared link.
 * When printed only the sheet shows, and the browser saves it as PDF.
 */
export function CvSheet({ cv, footerNote }: { cv: VolunteerCv; footerNote?: string }) {
  const p = cv.person;
  const place = [p.city, p.governorate ? GOVERNORATE_LABELS_AR[p.governorate] : ""]
    .filter(Boolean)
    .join("، ");
  const education = [p.educationLevel ? EDUCATION_LABELS_AR[p.educationLevel] : "", p.fieldOfStudy]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="cv-sheet mx-auto max-w-[210mm] space-y-7 p-8 sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-primary/30 pb-6">
        <div>
          <h2 className="font-display text-3xl font-black text-ink">{p.name}</h2>
          <p className="mt-1 text-sm font-bold text-primary-ink">سيرة العمل التطوعي</p>
          <div className="mt-3 space-y-0.5 text-xs font-semibold text-muted">
            {place ? <p>{place}</p> : null}
            {education ? <p>{education}</p> : null}
            {p.workField ? <p>{p.workField}</p> : null}
          </div>
        </div>
        <div className="text-left">
          <div className="font-display text-xl font-black text-primary-ink">واثق</div>
          <div className="text-[10px] font-bold text-muted">صادرة في {formatDay(cv.generatedAt)}</div>
        </div>
      </header>

      {p.bio ? <p className="text-sm font-medium leading-8 text-ink-soft">{p.bio}</p> : null}

      <section className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <Stat value={cv.stats.completedEvents} label="فعالية شارك فيها" />
        <Stat value={cv.stats.volunteerHours} label="ساعة تطوع" />
        <Stat value={cv.stats.approvedBadges} label="شارة وشهادة" />
        <Stat value={cv.teams.length} label="فريق" />
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-base font-black text-ink">المشاركات التطوعية</h3>
        {cv.badges.length === 0 ? (
          <p className="text-xs font-semibold text-muted">لا توجد شارات ممنوحة بعد.</p>
        ) : (
          <ol className="space-y-3">
            {cv.badges.map((b) => (
              <li
                key={b.id}
                className="relative break-inside-avoid rounded-2xl border border-line p-4 transition hover:border-primary/50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {/* The whole entry opens the event's documentation (the link stretches over it). */}
                  <Link
                    href={badgeHref(b.event.id)}
                    className="text-sm font-black text-ink after:absolute after:inset-0 after:rounded-[inherit] hover:text-primary-ink"
                  >
                    {b.event.title}
                  </Link>
                  <span className="text-[11px] font-bold text-muted">{formatDay(b.event.startsAt)}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {b.event.organizer.name} · {b.event.section.nameAr}
                  {b.role ? ` · الدور: ${b.role}` : ""}
                  {b.kind === "CERTIFICATE" ? " · شهادة حضور" : ""}
                </p>
                {b.description ? (
                  <p className="mt-1.5 text-xs font-medium leading-6 text-ink-soft">«{b.description}»</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {cv.impact.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-base font-black text-ink">أثر الفعاليات التي شاركت فيها</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cv.impact.map((m) => (
              <Stat key={m.label} value={m.total} label={m.label} />
            ))}
          </div>
        </section>
      ) : null}

      {cv.teams.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-base font-black text-ink">الفرق</h3>
          <ul className="space-y-2">
            {cv.teams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                <span className="text-sm font-black text-ink">
                  {t.team.name}
                  {t.role ? <span className="font-bold text-muted"> · {t.role}</span> : null}
                </span>
                <span className="text-[11px] font-bold text-muted">{yearRange(t.startYear, t.endYear)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="space-y-1 border-t border-line pt-4 text-[10px] font-semibold text-muted">
        <p>الشارات تمنحها جهات موثّقة على منصة واثق بعد توثيق كل فعالية.</p>
        <p>{HOURS_NOTE}</p>
        {footerNote ? <p>{footerNote}</p> : null}
      </footer>
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-icy p-3">
      <div className="font-display text-2xl font-black text-primary-ink">{value}</div>
      <div className="text-[11px] font-bold text-muted">{label}</div>
    </div>
  );
}

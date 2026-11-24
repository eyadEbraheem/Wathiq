import Link from "next/link";
import { GOVERNORATE_LABELS_AR, newVolunteersWordAr, type Governorate } from "@csh/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { WeeklyHighlight } from "@/lib/types";

const dayMonth = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Damascus",
});

/** Arabic counted noun (shared with the mobile app). */
export const newVolunteersWord = newVolunteersWordAr;

/** "14 – 20 تشرين الثاني": Saturday to Friday of the week (weekEnd is the next Saturday). */
export function weekRange(h: Pick<WeeklyHighlight, "weekStart" | "weekEnd">): string {
  const last = new Date(new Date(h.weekEnd).getTime() - 24 * 60 * 60 * 1000);
  return `${dayMonth.format(new Date(h.weekStart))} – ${dayMonth.format(last)}`;
}

/**
 * The organization of the week at the top of the home page, for everyone (visitors too): the
 * account that brought the most first-time volunteers in the last finished week.
 */
export function WeeklyHighlightCard({
  highlight,
}: {
  highlight: WeeklyHighlight & { organizer: NonNullable<WeeklyHighlight["organizer"]> };
}) {
  const o = highlight.organizer;
  const place = [o.city, o.governorate ? GOVERNORATE_LABELS_AR[o.governorate as Governorate] : ""]
    .filter(Boolean)
    .join("، ");
  return (
    <section
      aria-label="جمعية الأسبوع"
      className="relative overflow-hidden rounded-3xl bg-navy-grad p-5 text-white shadow-glow sm:p-6"
    >
      <Icon
        name="star"
        className="pointer-events-none absolute -left-6 -top-6 h-36 w-36 text-white/10"
        strokeWidth={1.2}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <Avatar name={o.name} src={o.avatarUrl} verified size="lg" />
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black">
              <Icon name="star" className="h-3.5 w-3.5" />
              جمعية الأسبوع · {weekRange(highlight)}
            </p>
            <Link
              href={`/users/${o.id}`}
              className="mt-2 block font-display text-xl font-black hover:underline sm:text-2xl"
            >
              {o.name}
            </Link>
            {place ? <p className="text-xs font-semibold text-white/75">{place}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="font-display text-4xl font-black leading-none">
              {highlight.newVolunteers}
            </div>
            <div className="mt-1 text-[11px] font-bold text-white/80">
              {newVolunteersWord(highlight.newVolunteers)} استقبلتهم
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={`/users/${o.id}`}
              className="organic organic-sm inline-flex h-9 items-center justify-center bg-white px-4 text-xs font-black text-primary-ink"
            >
              صفحة الجمعية
            </Link>
            <Link
              href="/highlights"
              className="text-center text-[11px] font-extrabold text-white/85 hover:text-white hover:underline"
            >
              لوحة الشرف ←
            </Link>
          </div>
        </div>
      </div>
      <p className="relative mt-4 text-[11px] font-semibold leading-5 text-white/70">
        تُختار كل أسبوع الجهة التي فتحت بابها لأكبر عدد من المتطوعين لأول مرة في فعاليات اكتملت ووُثّقت.
      </p>
    </section>
  );
}

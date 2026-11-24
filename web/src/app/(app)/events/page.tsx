import Link from "next/link";
import { GOVERNORATE_LABELS_AR, type Governorate } from "@csh/shared";
import { FeedCard } from "@/components/feed/FeedCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { isFrozen, isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import type { Paginated, PostView, Section } from "@/lib/types";

export const metadata = { title: "الفعاليات التطوعية · واثق" };

type SearchParams = Promise<{ section?: string; governorate?: string; page?: string }>;

const PAGE_SIZE = 12;

/** Upcoming events with open registration, soonest first; filter by section and governorate. */
export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  const sectionId = Number(params.section) > 0 ? Number(params.section) : undefined;
  const governorate =
    params.governorate && params.governorate in GOVERNORATE_LABELS_AR
      ? (params.governorate as Governorate)
      : undefined;
  const page = Number(params.page) > 1 ? Number(params.page) : 1;

  const query = new URLSearchParams({ status: "OPEN", page: String(page), limit: String(PAGE_SIZE) });
  if (sectionId) query.set("sectionId", String(sectionId));
  if (governorate) query.set("governorate", governorate);

  const [eventsRes, sectionsRes] = await Promise.all([
    apiFetch(`/events?${query.toString()}`, { token }),
    apiFetch("/sections?limit=100"),
  ]);
  if (!eventsRes.ok) throw new Error(`Events failed with ${eventsRes.status}`);
  const events = (await eventsRes.json()) as Paginated<PostView>;
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];

  const link = (q: { section?: number | null; governorate?: string | null; page?: number }) => {
    const search = new URLSearchParams();
    const s = q.section === undefined ? sectionId : q.section;
    const g = q.governorate === undefined ? governorate : q.governorate;
    if (s) search.set("section", String(s));
    if (g) search.set("governorate", g);
    if (q.page && q.page > 1) search.set("page", String(q.page));
    const text = search.toString();
    return text ? `/events?${text}` : "/events";
  };
  const chip = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-glow" : "bg-icy/70 font-extrabold text-ink hover:bg-icy"
    }`;

  return (
    <div className="view-pop space-y-6">
      <div>
        <h1 className="font-display text-xl font-black text-ink">الفعاليات التطوعية</h1>
        <p className="text-xs font-semibold text-muted">
          فعاليات يفتح فيها التسجيل الآن، الأقرب موعداً أولاً. قدّم، واختر دورك إن وُجدت أدوار.
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black text-muted">القسم:</span>
          <Link href={link({ section: null, page: 1 })} className={chip(!sectionId)}>
            الكل
          </Link>
          {sections.map((s) => (
            <Link key={s.id} href={link({ section: s.id, page: 1 })} className={chip(sectionId === s.id)}>
              {s.nameAr}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/events">
          {sectionId ? <input type="hidden" name="section" value={sectionId} /> : null}
          <label htmlFor="governorate" className="text-[11px] font-black text-muted">
            المحافظة:
          </label>
          <select
            id="governorate"
            name="governorate"
            defaultValue={governorate ?? ""}
            className="h-9 rounded-2xl border border-line bg-canvas px-3 text-xs font-bold text-ink outline-none focus:border-primary"
          >
            <option value="">كل المحافظات</option>
            {Object.entries(GOVERNORATE_LABELS_AR).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="organic organic-sm bg-navy-grad px-4 py-2 text-xs font-black text-white">
            عرض
          </button>
        </form>
      </Card>

      {events.data.length === 0 ? (
        <Card className="space-y-2.5 p-10 text-center">
          <Icon name="calendar" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">لا توجد فعاليات مفتوحة بهذه الشروط حالياً</p>
          <ButtonLink href="/events" size="sm" className="mt-2">
            عرض كل الفعاليات
          </ButtonLink>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.data.map((post) => (
              <FeedCard key={post.id} post={post} back={link({})} canVolunteer={!isOrganization(me)} readOnly={isFrozen(me)} />
            ))}
          </div>
          {events.meta.totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
              {page > 1 ? (
                <ButtonLink href={link({ page: page - 1 })} variant="secondary" size="sm">
                  السابق
                </ButtonLink>
              ) : null}
              <span className="text-xs font-bold text-muted">
                صفحة {page} من {events.meta.totalPages}
              </span>
              {page < events.meta.totalPages ? (
                <ButtonLink href={link({ page: page + 1 })} variant="secondary" size="sm">
                  التالي
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

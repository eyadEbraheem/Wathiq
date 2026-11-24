import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type { MyPostsPage } from "@/lib/types";

export const metadata = { title: "منشوراتي ومبادراتي · واثق" };

type SearchParams = Promise<{
  tab?: string;
  status?: string;
  q?: string;
  sort?: string;
  page?: string;
}>;

const TABS = [
  { key: "all", label: "الكل", count: "all" },
  { key: "events", label: "الفعاليات", count: "events" },
  { key: "posts", label: "المنشورات", count: "posts" },
  { key: "hidden", label: "أخفتها الإدارة", count: "hidden" },
] as const;

const EVENT_STATUSES = [
  { key: "OPEN", label: "مفتوحة" },
  { key: "CLOSED", label: "مغلقة" },
  { key: "COMPLETED", label: "مكتملة" },
  { key: "CANCELLED", label: "ملغاة" },
] as const;

const EVENT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_STATUSES.map((s) => [s.key, s.label]),
);

const PAGE_SIZE = 15;

/**
 * A verified account's own posts and events in one place: find them by type, event status or
 * title, see their numbers and what waits for a reply, and jump to the post or its management.
 */
export default async function MyPostsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me?.verifiedKind) redirect("/me");
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "all";
  const status = EVENT_STATUSES.some((s) => s.key === params.status) ? params.status : undefined;
  const q = (params.q ?? "").trim().slice(0, 100);
  const sort = params.sort === "top" ? "top" : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
  if (tab === "events") query.set("kind", "EVENT");
  if (tab === "posts") query.set("kind", "POST");
  if (tab === "hidden") query.set("hidden", "true");
  if (tab === "events" && status) query.set("eventStatus", status);
  if (q) query.set("q", q);
  const res = await apiFetch(`/users/me/posts?${query.toString()}`, { token });
  if (!res.ok) throw new Error(`My posts failed with ${res.status}`);
  const list = (await res.json()) as MyPostsPage;

  const link = (next: { tab?: string; status?: string | null; sort?: string; page?: number }) => {
    const p = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t !== "all") p.set("tab", t);
    const st = next.status === undefined ? status : next.status;
    if (t === "events" && st) p.set("status", st);
    if (q) p.set("q", q);
    const so = next.sort ?? sort;
    if (so !== "newest") p.set("sort", so);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const s = p.toString();
    return `/my-posts${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;

  return (
    <div className="view-pop space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">منشوراتي ومبادراتي</h1>
          <p className="text-xs font-semibold text-muted">
            كل ما نشرتموه في مكان واحد: ابحثوا، رتّبوا، وتابعوا ما ينتظر ردّكم.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/new" className="organic organic-sm inline-flex h-9 items-center gap-1.5 bg-teal-grad px-4 text-xs font-black text-white">
            <Icon name="plus" className="h-4 w-4" />
            منشور
          </Link>
          <Link
            href="/new?type=event"
            className="organic organic-sm inline-flex h-9 items-center gap-1.5 border border-primary/30 bg-icy px-4 text-xs font-black text-primary-ink"
          >
            <Icon name="calendar" className="h-4 w-4" />
            فعالية
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5" aria-label="النوع">
          {TABS.map((t) => (
            <Link key={t.key} href={link({ tab: t.key, status: null, page: 1 })} className={chip(tab === t.key)}>
              {t.label} <span className="opacity-70">({list.counts[t.count]})</span>
            </Link>
          ))}
        </nav>
        <form action="/my-posts" className="ms-auto flex items-center gap-2">
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          {tab === "events" && status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث في العناوين"
            aria-label="ابحث في العناوين"
            className="h-9 w-48 rounded-2xl border border-line bg-surface px-3 text-xs font-bold text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button type="submit" className="organic organic-sm h-9 border border-line bg-surface px-3 text-xs font-black text-ink">
            بحث
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {tab === "events" ? (
          <div className="flex flex-wrap gap-1.5" aria-label="حالة الفعالية">
            <Link href={link({ status: null, page: 1 })} className={chip(!status)}>
              كل الحالات
            </Link>
            {EVENT_STATUSES.map((s) => (
              <Link key={s.key} href={link({ status: s.key, page: 1 })} className={chip(status === s.key)}>
                {s.label}
              </Link>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-1.5">
          <Link href={link({ sort: "newest", page: 1 })} className={chip(sort === "newest")}>
            الأحدث
          </Link>
          <Link href={link({ sort: "top", page: 1 })} className={chip(sort === "top")}>
            الأكثر رفعاً
          </Link>
        </div>
      </div>

      {list.data.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-10 text-center text-sm font-bold text-muted">
          {q ? `لا شيء بعنوان فيه «${q}».` : "لا يوجد شيء هنا بعد."}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.data.map((p) => {
            const look = sectionLook(p.section.slug);
            const ev = p.event;
            const waiting = (p.waiting?.applications ?? 0) + (p.waiting?.badges ?? 0);
            return (
              <li key={p.id} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                <Link href={`/posts/${p.id}`} className="h-20 w-full shrink-0 overflow-hidden rounded-2xl sm:w-28">
                  {p.media[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className={`flex h-full w-full items-center justify-center ${look.solid}`}>
                      <Icon name={look.icon} className="h-8 w-8 opacity-80" />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                    <span className={`rounded-full px-2.5 py-0.5 ${look.solid}`}>{p.section.nameAr}</span>
                    <span className="rounded-full bg-icy px-2.5 py-0.5 text-primary-ink">
                      {p.kind === "EVENT" ? "فعالية" : p.opportunity ? "فرصة" : "منشور"}
                    </span>
                    {ev ? (
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-ink">
                        {EVENT_STATUS_LABEL[ev.status]}
                      </span>
                    ) : null}
                    {p.status === "HIDDEN" ? (
                      <span className="rounded-full bg-humanitarian/10 px-2.5 py-0.5 text-humanitarian-ink">
                        أخفته الإدارة
                      </span>
                    ) : null}
                    {waiting > 0 ? (
                      <span className="rounded-full bg-community/15 px-2.5 py-0.5 text-community-ink">
                        ينتظر ردّكم: {p.waiting!.applications ? `${p.waiting!.applications} طلب تطوع` : ""}
                        {p.waiting!.applications && p.waiting!.badges ? " · " : ""}
                        {p.waiting!.badges ? `${p.waiting!.badges} طلب شارة` : ""}
                      </span>
                    ) : null}
                  </div>
                  <Link href={`/posts/${p.id}`} className="block truncate text-sm font-black text-ink hover:text-primary-ink">
                    {p.title}
                  </Link>
                  <p className="text-[11px] font-bold text-muted">
                    {ev ? `موعدها ${formatDay(ev.startsAt)} · ` : ""}نُشر {formatDay(p.createdAt)}
                    {" · "}
                    {p.upvoteCount} رفعة · {p.commentCount} تعليق
                    {ev && ev.capacity !== null ? ` · ${ev.acceptedCount} من ${ev.capacity} مقعد` : ""}
                    {ev && ev.capacity === null ? ` · ${ev.acceptedCount} مقبول` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/posts/${p.id}`}
                    className="organic organic-sm inline-flex h-9 items-center border border-line bg-canvas px-4 text-xs font-black text-ink"
                  >
                    عرض
                  </Link>
                  {p.kind === "EVENT" ? (
                    <Link
                      href={`/posts/${p.id}/manage${p.waiting?.badges && !p.waiting.applications ? "?tab=badges" : ""}`}
                      className="organic organic-sm inline-flex h-9 items-center bg-teal-grad px-4 text-xs font-black text-white"
                    >
                      إدارة الفعالية
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-xs font-black" aria-label="الصفحات">
          {page > 1 ? (
            <Link href={link({ page: page - 1 })} className="text-primary-ink hover:underline">
              → السابق
            </Link>
          ) : null}
          <span className="text-muted">
            صفحة {page} من {list.meta.totalPages}
          </span>
          {page < list.meta.totalPages ? (
            <Link href={link({ page: page + 1 })} className="text-primary-ink hover:underline">
              التالي ←
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { FeedCard } from "@/components/feed/FeedCard";
import { SectionTree } from "@/components/feed/SectionTree";
import { WeeklyHighlightCard } from "@/components/highlights/WeeklyHighlightCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { isFrozen, isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import type { Paginated, PostView, Section, WeeklyHighlight } from "@/lib/types";

type SearchParams = Promise<{ section?: string; topic?: string; sort?: string; page?: string }>;

const PAGE_SIZE = 12;

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = await getSessionToken();
  const [user, sectionsRes, highlightRes] = await Promise.all([
    fetchCurrentUser(token),
    apiFetch("/sections?limit=100"),
    // Public: the organization of the week (404 until a week has been computed).
    apiFetch("/highlights/current"),
  ]);
  const highlight = highlightRes.ok ? ((await highlightRes.json()) as WeeklyHighlight) : null;
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];

  // Home section: the chosen one, else the user's primary section, else humanitarian.
  const humanitarian = sections.find((s) => s.slug === "humanitarian");
  const sectionId =
    positiveInt(params.section) ?? user?.primarySectionId ?? humanitarian?.id ?? sections[0]?.id;
  const topicId = positiveInt(params.topic);
  const sort = params.sort === "top" ? "top" : "newest";
  const page = positiveInt(params.page) ?? 1;

  const link = (q: { section?: number; topic?: number | null; sort?: string; page?: number }) => {
    const search = new URLSearchParams();
    search.set("section", String(q.section ?? sectionId));
    const topic = q.topic === undefined ? (q.section ? undefined : topicId) : q.topic;
    if (topic) search.set("topic", String(topic));
    search.set("sort", q.sort ?? sort);
    if (q.page && q.page > 1) search.set("page", String(q.page));
    return `/?${search.toString()}`;
  };

  // The feed needs an account (the API protects it); visitors get an invitation instead.
  let feed: Paginated<PostView> | null = null;
  if (token && sectionId) {
    const query = new URLSearchParams({
      sectionId: String(sectionId),
      sort,
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (topicId) query.set("topicId", String(topicId));
    const res = await apiFetch(`/posts?${query.toString()}`, { token });
    if (!res.ok) throw new Error(`Feed failed with ${res.status}`);
    feed = (await res.json()) as Paginated<PostView>;
  }

  const active = sections.find((s) => s.id === sectionId);
  const back = link({});

  return (
    <div className="view-pop space-y-6">
      {user && !user.onboardingCompletedAt ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-display text-base font-black text-ink">اختر اهتماماتك</p>
            <p className="text-xs font-semibold text-muted">
              حتى نعرض لك المبادرات والفعاليات التي تهمّك أولاً.
            </p>
          </div>
          <ButtonLink href="/onboarding" size="sm">
            ابدأ الآن
          </ButtonLink>
        </Card>
      ) : null}

      {highlight?.organizer ? (
        <WeeklyHighlightCard highlight={{ ...highlight, organizer: highlight.organizer }} />
      ) : null}

      {sections.length > 0 && sectionId ? (
        <SectionTree sections={sections} activeId={sectionId} topicId={topicId} link={link} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-black text-ink">
            {active ? `أحدث ما في قسم ${active.nameAr}` : "أحدث المبادرات"}
          </h1>
          <p className="text-xs font-semibold text-muted">
            منشورات وفعاليات وحالات من حسابات موثّقة. ارفع ما يعجبك وعلّق وتطوّع مباشرة.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
          <Link
            href={link({ sort: "newest" })}
            prefetch
            aria-current={sort === "newest" ? "true" : undefined}
            className={`organic organic-sm px-4 py-1.5 text-xs ${
              sort === "newest"
                ? "flipped bg-teal-grad font-black text-white shadow-sm"
                : "font-extrabold text-muted hover:text-ink"
            }`}
          >
            الأحدث
          </Link>
          <Link
            href={link({ sort: "top" })}
            prefetch
            aria-current={sort === "top" ? "true" : undefined}
            className={`organic organic-sm px-4 py-1.5 text-xs ${
              sort === "top"
                ? "flipped bg-teal-grad font-black text-white shadow-sm"
                : "font-extrabold text-muted hover:text-ink"
            }`}
          >
            الأكثر رفعاً ↑
          </Link>
        </div>
      </div>

      {!token ? (
        <Card className="space-y-3 p-10 text-center">
          <Icon name="users" className="mx-auto h-10 w-10 text-primary" />
          <p className="font-display text-lg font-black text-ink">انضم لترى ما يحدث من حولك</p>
          <p className="mx-auto max-w-md text-sm font-semibold text-muted">
            المبادرات والفعاليات والحالات الإنسانية متاحة لأعضاء واثق. التسجيل مجاني ويأخذ دقيقة.
          </p>
          <div className="flex justify-center gap-2">
            <ButtonLink href="/register">إنشاء حساب</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              تسجيل الدخول
            </ButtonLink>
          </div>
        </Card>
      ) : feed && feed.data.length === 0 ? (
        <Card className="space-y-2.5 p-10 text-center">
          <Icon name="search" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">لا يوجد شيء هنا بعد</p>
          <p className="text-xs font-semibold text-muted">
            جرّب قسماً أو موضوعاً آخر، أو عُد لاحقاً.
          </p>
          {topicId ? (
            <ButtonLink href={link({ topic: null })} size="sm" className="mt-2">
              عرض كل المواضيع
            </ButtonLink>
          ) : null}
        </Card>
      ) : feed ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {feed.data.map((post) => (
              <FeedCard key={post.id} post={post} back={back} canVolunteer={!isOrganization(user)} readOnly={isFrozen(user)} />
            ))}
          </div>
          {feed.meta.totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
              {page > 1 ? (
                <ButtonLink href={link({ page: page - 1 })} variant="secondary" size="sm">
                  الأحدث
                </ButtonLink>
              ) : null}
              <span className="text-xs font-bold text-muted">
                صفحة {page} من {feed.meta.totalPages}
              </span>
              {page < feed.meta.totalPages ? (
                <ButtonLink href={link({ page: page + 1 })} variant="secondary" size="sm">
                  الأقدم
                </ButtonLink>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { GOVERNORATE_LABELS_AR } from "@csh/shared";
import { SectionTree } from "@/components/feed/SectionTree";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/api";
import { formatAccounts } from "@/lib/format";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type { DirectoryAccount, DirectoryPage, Paginated, Section } from "@/lib/types";

export const metadata = { title: "الجمعيات والحسابات الموثّقة · واثق" };

type SearchParams = Promise<{ section?: string; page?: string }>;

const PAGE_SIZE = 24;

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** All verified accounts, by section of interest, best-rated first. Laid out like the home page. */
export default async function OrganizationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sectionId = positiveInt(params.section);
  const page = positiveInt(params.page) ?? 1;
  const token = await requireSessionToken();

  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (sectionId) query.set("sectionId", String(sectionId));
  const [sectionsRes, directoryRes] = await Promise.all([
    apiFetch("/sections?limit=100", { token }),
    apiFetch(`/search/directory?${query.toString()}`, { token }),
  ]);
  if (!directoryRes.ok) throw new Error(`Directory failed with ${directoryRes.status}`);
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];
  const directory = (await directoryRes.json()) as DirectoryPage;
  const countOf = new Map(directory.sections.map((s) => [s.sectionId, s.count]));
  const active = sections.find((s) => s.id === sectionId);

  const link = (q: { section?: number; page?: number }) => {
    const search = new URLSearchParams();
    const section = q.section ?? sectionId;
    if (section) search.set("section", String(section));
    if (q.page && q.page > 1) search.set("page", String(q.page));
    const s = search.toString();
    return s ? `/organizations?${s}` : "/organizations";
  };
  // The rank of the first card on this page (the list continues across pages).
  const firstRank = (page - 1) * PAGE_SIZE + 1;

  return (
    <div className="view-pop space-y-6">
      {sections.length > 0 ? (
        <SectionTree
          sections={sections}
          activeId={sectionId ?? 0}
          link={(q) => link({ section: q.section })}
          rootLabel="كل الجهات الموثّقة"
          rootCount={sectionId ? "عرض الكل" : formatAccounts(directory.meta.total)}
          subtitle={(s) => {
            // Short form: the section cards are narrow.
            const n = countOf.get(s.id) ?? 0;
            return `${n} ${n >= 3 && n <= 10 ? "جهات" : "جهة"}`;
          }}
          allHref="/organizations"
          showTopics={false}
        />
      ) : null}

      <div>
        <h1 className="font-display text-lg font-black text-ink">
          {active ? `جهات قسم ${active.nameAr}` : "الجمعيات والحسابات الموثّقة"}
        </h1>
        <p className="text-xs font-semibold text-muted">
          الأعلى تقييماً من المتطوعين أولاً. يظهر التقييم بعد 3 تقييمات على الأقل.
        </p>
      </div>

      {directory.data.length === 0 ? (
        <Card className="space-y-2.5 p-10 text-center">
          <Icon name="building" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">لا توجد جهات موثّقة في هذا القسم بعد</p>
          {sectionId ? (
            <ButtonLink href="/organizations" size="sm" className="mt-2">
              عرض كل الجهات
            </ButtonLink>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {directory.data.map((a, i) => (
              <AccountCard key={a.id} account={a} rank={firstRank + i} sections={sections} />
            ))}
          </div>
          {directory.meta.totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
              {page > 1 ? (
                <ButtonLink href={link({ page: page - 1 })} variant="secondary" size="sm">
                  السابق
                </ButtonLink>
              ) : null}
              <span className="text-xs font-bold text-muted">
                صفحة {page} من {directory.meta.totalPages}
              </span>
              {page < directory.meta.totalPages ? (
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

function AccountCard({
  account: a,
  rank,
  sections,
}: {
  account: DirectoryAccount;
  rank: number;
  sections: Section[];
}) {
  const rated = a.rating.average !== null;
  // A rank badge only for real rated leaders, never for an unrated account in the top 3.
  const medal = rated && rank <= 3;
  const mine = sections.filter((s) => a.sectionIds.includes(s.id));
  return (
    <Link href={`/users/${a.id}`} className="block">
      <Card className="relative flex h-full flex-col gap-3 p-5 transition hover:shadow-soft-hover">
        {medal ? (
          <span
            className="organic organic-sm absolute left-4 top-4 bg-teal-grad px-2.5 py-1 text-[10px] font-black text-white shadow-glow"
            title="من الأعلى تقييماً"
          >
            #{rank}
          </span>
        ) : null}
        <div className="flex items-start gap-3">
          <Avatar name={a.name} src={a.avatarUrl} verified />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-ink">{a.name}</div>
            <div className="text-[11px] font-semibold text-muted">
              {a.verifiedKind === "ORGANIZATION" ? "منظمة موثّقة" : "حساب موثّق"}
              {a.isPartner ? " · شريك" : ""}
              {a.region ? ` · ${a.region.city || GOVERNORATE_LABELS_AR[a.region.governorate]}` : ""}
            </div>
          </div>
        </div>

        {a.bio ? <p className="line-clamp-2 text-xs font-medium leading-6 text-ink-soft">{a.bio}</p> : null}

        {mine.length > 0 || a.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {mine.map((s) => (
              <span key={`s${s.id}`} className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${sectionLook(s.slug).soft}`}>
                {s.nameAr}
              </span>
            ))}
            {a.specialties.slice(0, 3).map((s) => (
              <span key={s.id} className="rounded-full bg-icy px-2 py-0.5 text-[10px] font-black text-primary-ink">
                {s.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-3 text-[11px] font-bold">
          <span className="flex items-center gap-1">
            {rated ? (
              <>
                <span className="text-base leading-none text-[#F5A524]" aria-hidden="true">
                  ★
                </span>
                <span className="font-display text-sm font-black text-ink">{a.rating.average}</span>
                <span className="text-muted">({a.rating.count} تقييم)</span>
              </>
            ) : (
              <span className="text-muted">{a.rating.hidden ? "التقييم مخفي" : "لا تقييم بعد"}</span>
            )}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {a.completedEvents > 0 ? `${a.completedEvents} فعالية منجزة` : "لا فعاليات منجزة بعد"}
          </span>
        </div>
      </Card>
    </Link>
  );
}

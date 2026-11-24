import Link from "next/link";
import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR, type Governorate } from "@csh/shared";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import type { ApplicantProfile, Paginated, Section, UserCard } from "@/lib/types";

export const metadata = { title: "البحث · واثق" };

type SearchParams = Promise<Record<string, string | undefined>>;

interface AccountResult extends UserCard {
  bio: string;
  region: { governorate: Governorate; city: string } | null;
  specialties: { id: number; name: string }[];
}

interface PersonResult extends ApplicantProfile {
  completedVolunteering: number;
}

interface Region {
  governorate: Governorate;
  accounts: number;
  cities: { city: string; accounts: number }[];
}

const PAGE_SIZE = 20;
const select =
  "h-11 rounded-2xl border border-line bg-canvas px-3 text-xs font-bold text-ink outline-none focus:border-primary";
const input = `${select} w-full`;

/** Search verified accounts (everyone) or people (verified accounts only). */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  const canSearchPeople = Boolean(me?.verifiedKind);
  const tab = params.tab === "people" && canSearchPeople ? "people" : "accounts";
  const page = Number(params.page) > 1 ? Number(params.page) : 1;

  // Only the filters this tab understands are forwarded to the API.
  const keys =
    tab === "accounts"
      ? ["q", "governorate", "city", "specialtyId"]
      : ["q", "governorate", "city", "educationLevel", "fieldOfStudy", "workField", "hasVolunteered", "sectionId"];
  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  for (const key of keys) {
    const value = params[key]?.trim();
    if (value) query.set(key, value);
  }

  const [resultsRes, regionsRes, specialtiesRes, sectionsRes] = await Promise.all([
    apiFetch(`/search/${tab}?${query.toString()}`, { token }),
    apiFetch("/search/accounts/regions", { token }),
    tab === "accounts" ? apiFetch("/specialties?limit=100", { token }) : null,
    tab === "people" ? apiFetch("/sections?limit=100") : null,
  ]);
  const results = resultsRes.ok
    ? ((await resultsRes.json()) as Paginated<AccountResult | PersonResult>)
    : null;
  const regions = regionsRes.ok ? ((await regionsRes.json()) as { data: Region[] }).data : [];
  const specialties =
    specialtiesRes?.ok ? ((await specialtiesRes.json()) as Paginated<{ id: number; name: string }>).data : [];
  const sections = sectionsRes?.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];
  const cities = regions.find((r) => r.governorate === params.governorate)?.cities ?? [];
  const pageHref = (n: number) => {
    const s = new URLSearchParams();
    s.set("tab", tab);
    for (const key of keys) if (params[key]) s.set(key, params[key] as string);
    if (n > 1) s.set("page", String(n));
    return `/search?${s.toString()}`;
  };
  const tabClass = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;

  return (
    <div className="view-pop space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">البحث</h1>
          <p className="text-xs font-semibold text-muted">
            {tab === "accounts"
              ? "منظمات وأشخاص موثّقون، بالاسم أو المنطقة أو الاختصاص."
              : "أشخاص بحسب ما اختاروا إظهاره فقط. من هم دون 18 تبقى معلوماتهم الاختيارية مخفية."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
          <Link href="/search" className={tabClass(tab === "accounts")}>
            الحسابات الموثّقة
          </Link>
          {canSearchPeople ? (
            <Link href="/search?tab=people" className={tabClass(tab === "people")}>
              الأشخاص
            </Link>
          ) : null}
        </div>
      </div>

      <Card className="p-5">
        <form action="/search" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="tab" value={tab} />
          <label className="sm:col-span-2">
            <span className="sr-only">الاسم</span>
            <input name="q" defaultValue={params.q ?? ""} placeholder="ابحث بالاسم…" className={input} />
          </label>
          <label>
            <span className="sr-only">المحافظة</span>
            <select name="governorate" defaultValue={params.governorate ?? ""} className={`${select} w-full`}>
              <option value="">كل المحافظات</option>
              {(tab === "accounts" ? regions.map((r) => r.governorate) : Object.keys(GOVERNORATE_LABELS_AR)).map(
                (g) => (
                  <option key={g} value={g}>
                    {GOVERNORATE_LABELS_AR[g as Governorate]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <span className="sr-only">المدينة</span>
            {tab === "accounts" ? (
              <select name="city" defaultValue={params.city ?? ""} className={`${select} w-full`}>
                <option value="">{params.governorate ? "كل المدن" : "اختر المحافظة أولاً"}</option>
                {cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            ) : (
              <input name="city" defaultValue={params.city ?? ""} placeholder="المدينة" className={input} />
            )}
          </label>

          {tab === "accounts" ? (
            <label className="sm:col-span-2">
              <span className="sr-only">الاختصاص</span>
              <select name="specialtyId" defaultValue={params.specialtyId ?? ""} className={`${select} w-full`}>
                <option value="">كل الاختصاصات</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span className="sr-only">التعليم</span>
                <select name="educationLevel" defaultValue={params.educationLevel ?? ""} className={`${select} w-full`}>
                  <option value="">أي مستوى تعليمي</option>
                  {Object.entries(EDUCATION_LABELS_AR).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <input name="fieldOfStudy" defaultValue={params.fieldOfStudy ?? ""} placeholder="مجال الدراسة" className={input} aria-label="مجال الدراسة" />
              <input name="workField" defaultValue={params.workField ?? ""} placeholder="مجال العمل" className={input} aria-label="مجال العمل" />
              <select name="sectionId" defaultValue={params.sectionId ?? ""} className={`${select} w-full`} aria-label="مهتم بقسم">
                <option value="">مهتم بأي قسم</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    مهتم بـ{s.nameAr}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  name="hasVolunteered"
                  value="true"
                  defaultChecked={params.hasVolunteered === "true"}
                  className="h-4 w-4 accent-[rgb(var(--c-primary))]"
                />
                شارك في عمل تطوعي سابق
              </label>
            </>
          )}
          <button type="submit" className="organic h-11 bg-teal-grad text-sm font-black text-white shadow-glow">
            بحث
          </button>
        </form>
      </Card>

      {!results ? (
        <Card className="p-8 text-center text-sm font-bold text-muted">تعذّر البحث الآن. حاول مرة أخرى.</Card>
      ) : results.data.length === 0 ? (
        <Card className="space-y-2 p-10 text-center">
          <Icon name="search" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">لا نتائج بهذه الشروط</p>
          <ButtonLink href={tab === "people" ? "/search?tab=people" : "/search"} size="sm" className="mt-2">
            مسح الفلاتر
          </ButtonLink>
        </Card>
      ) : (
        <>
          <p className="text-xs font-bold text-muted">{results.meta.total} نتيجة</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.data.map((r) => (
              <Link key={r.id} href={`/users/${r.id}`}>
                <Card className="flex h-full items-start gap-3 p-5 transition hover:shadow-soft-hover">
                  <Avatar name={r.name} src={r.avatarUrl} verified={Boolean(r.verifiedKind)} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="truncate text-sm font-black text-ink">{r.name}</div>
                    {"specialties" in r ? (
                      <>
                        <div className="text-[11px] font-semibold text-muted">
                          {r.verifiedKind === "ORGANIZATION" ? "منظمة موثّقة" : "حساب موثّق"}
                          {r.region ? ` · ${r.region.city || GOVERNORATE_LABELS_AR[r.region.governorate]}` : ""}
                        </div>
                        {r.specialties.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.specialties.slice(0, 3).map((s) => (
                              <span key={s.id} className="rounded-full bg-icy px-2 py-0.5 text-[10px] font-black text-primary-ink">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-[11px] font-semibold text-muted">
                        {[
                          r.age !== null ? `${r.age} سنة` : null,
                          r.address?.city || null,
                          r.workField,
                          r.completedVolunteering > 0 ? `${r.completedVolunteering} مشاركة تطوعية` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "معلوماته مخفية"}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {results.meta.totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
              {page > 1 ? (
                <ButtonLink href={pageHref(page - 1)} variant="secondary" size="sm">
                  السابق
                </ButtonLink>
              ) : null}
              <span className="text-xs font-bold text-muted">
                صفحة {page} من {results.meta.totalPages}
              </span>
              {page < results.meta.totalPages ? (
                <ButtonLink href={pageHref(page + 1)} variant="secondary" size="sm">
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

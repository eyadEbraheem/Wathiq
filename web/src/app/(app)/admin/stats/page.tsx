import Link from "next/link";
import { notFound } from "next/navigation";
import type { StatsReport } from "@csh/shared";
import { StatsReportView } from "@/components/stats/StatsReportView";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import { statsQuery } from "@/lib/stats";
import type { Paginated, Section } from "@/lib/types";

export const metadata = { title: "إحصائيات المنصة · واثق" };

type SearchParams = Promise<{ period?: string; governorate?: string; sectionId?: string }>;

/** Platform statistics for admins: what runs most, what people ask for, where help is missing. */
export default async function AdminStatsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (me?.role !== "ADMIN") notFound();
  const [reportRes, sectionsRes] = await Promise.all([
    apiFetch(`/admin/stats?${statsQuery(await searchParams)}`, { token }),
    apiFetch("/sections?limit=100"),
  ]);
  if (!reportRes.ok) throw new Error(`Stats failed with ${reportRes.status}`);
  const report = (await reportRes.json()) as StatsReport;
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];

  return (
    <div className="view-pop space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">إحصائيات المنصة</h1>
          <p className="text-xs font-semibold text-muted">
            ما الحملات التي تُنفَّذ وتُطلب أكثر، وأين يوجد احتياج. كل الأرقام مجمّعة، بلا أسماء متطوعين.
          </p>
        </div>
        <Link href="/admin" className="text-xs font-black text-primary-ink hover:underline">
          → لوحة الإدارة
        </Link>
      </div>
      <StatsReportView report={report} basePath="/admin/stats" csvPath="/admin/stats/csv" sections={sections} />
    </div>
  );
}

import { redirect } from "next/navigation";
import type { StatsReport } from "@csh/shared";
import { StatsReportView } from "@/components/stats/StatsReportView";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import { statsQuery } from "@/lib/stats";
import type { Paginated, Section } from "@/lib/types";

export const metadata = { title: "إحصائيات حملاتنا · واثق" };

type SearchParams = Promise<{ period?: string; governorate?: string; sectionId?: string }>;

/** A verified account's statistics of its own campaigns. */
export default async function MyStatsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me?.verifiedKind) redirect("/me");
  const [reportRes, sectionsRes] = await Promise.all([
    apiFetch(`/users/me/stats?${statsQuery(await searchParams)}`, { token }),
    apiFetch("/sections?limit=100"),
  ]);
  if (!reportRes.ok) throw new Error(`Stats failed with ${reportRes.status}`);
  const report = (await reportRes.json()) as StatsReport;
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];

  return (
    <div className="view-pop space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">إحصائيات حملاتنا</h1>
        <p className="text-xs font-semibold text-muted">
          أرقام حملاتكم فقط: من تطوّع معكم، وأين، وما الذي يطلبه الناس أكثر. العمر والتحصيل يظهران فقط لمن
          اختار إظهارهما.
        </p>
      </div>
      <StatsReportView report={report} basePath="/stats" csvPath="/stats/csv" sections={sections} />
    </div>
  );
}

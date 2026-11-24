import Link from "next/link";
import {
  EDUCATION_LABELS_AR,
  GOVERNORATE_LABELS_AR,
  type EducationLevel,
  type Governorate,
  type StatsReport,
} from "@csh/shared";
import { BarList, KpiTile, MonthChart, num, Panel, pct, RatingBars } from "@/components/stats/charts";
import { Icon } from "@/components/ui/Icon";

const PERIODS = [
  { key: "30d", label: "آخر 30 يوماً" },
  { key: "90d", label: "آخر 3 أشهر" },
  { key: "365d", label: "آخر سنة" },
  { key: "all", label: "كل الفترات" },
] as const;

const SECTION_TONE: Record<string, string> = {
  humanitarian: "bg-humanitarian",
  environment: "bg-environment",
  "animal-welfare": "bg-animal-welfare",
  community: "bg-community",
  education: "bg-education",
};

const AGE_LABELS: Record<string, string> = {
  "13-17": "من 13 إلى 17 سنة",
  "18-24": "من 18 إلى 24 سنة",
  "25-34": "من 25 إلى 34 سنة",
  "35+": "35 سنة وأكثر",
  hidden: "لم يُظهروا العمر",
};

const gov = (g: string) => GOVERNORATE_LABELS_AR[g as Governorate] ?? g;
const small = (n: number | null) => (n === null ? "أقل من 5" : num(n));

/**
 * One statistics report (platform for admins, or a verified account's own campaigns). Server
 * component: the filters are a plain GET form, the charts are SVG/CSS.
 */
export function StatsReportView({
  report,
  basePath,
  csvPath,
  sections,
}: {
  report: StatsReport;
  basePath: string;
  csvPath: string;
  sections: { id: number; nameAr: string }[];
}) {
  const platform = report.scope === "platform";
  const t = report.totals;
  const p = report.previous;
  const query = new URLSearchParams({ period: report.period.key });
  if (report.filters.governorate) query.set("governorate", report.filters.governorate);
  if (report.filters.sectionId) query.set("sectionId", String(report.filters.sectionId));
  const needCampaigns = report.byGovernorate.filter((g) => g.signal === "NEEDS_CAMPAIGNS");
  const needVolunteers = report.byGovernorate.filter((g) => g.signal === "NEEDS_VOLUNTEERS");
  const select =
    "h-10 rounded-2xl border border-line bg-surface px-3 text-xs font-bold text-ink focus:border-primary focus:outline-none";

  return (
    <div className="space-y-5">
      {/* Filters: a GET form, so every view has its own link. */}
      <form action={basePath} className="flex flex-wrap items-end gap-2 rounded-3xl border border-line bg-surface p-3">
        <label className="space-y-1 text-[10px] font-extrabold text-muted">
          <span className="block">الفترة</span>
          <select name="period" defaultValue={report.period.key} className={select}>
            {PERIODS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] font-extrabold text-muted">
          <span className="block">المحافظة</span>
          <select name="governorate" defaultValue={report.filters.governorate ?? ""} className={select}>
            <option value="">كل المحافظات</option>
            {Object.entries(GOVERNORATE_LABELS_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] font-extrabold text-muted">
          <span className="block">القسم</span>
          <select name="sectionId" defaultValue={report.filters.sectionId ?? ""} className={select}>
            <option value="">كل الأقسام</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="organic organic-sm h-10 bg-teal-grad px-5 text-xs font-black text-white">
          عرض
        </button>
        <a
          href={`${csvPath}?${query.toString()}`}
          className="organic organic-sm ms-auto inline-flex h-10 items-center gap-1.5 border border-primary/30 bg-icy px-4 text-xs font-black text-primary-ink hover:bg-primary hover:text-white"
        >
          <Icon name="arrow" className="h-4 w-4 -rotate-90" />
          تنزيل الحملات CSV
        </a>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile value={t.completed} previous={p?.completed} label="حملة مكتملة" />
        <KpiTile value={t.volunteers} previous={p?.volunteers} label="متطوع شارك" />
        <KpiTile value={t.volunteerHours} previous={p?.volunteerHours} label="ساعة تطوع" />
        <KpiTile
          value={t.newVolunteers}
          previous={p?.newVolunteers}
          label={platform ? "متطوع جديد (أول مرة)" : "تطوّعوا لأول مرة معكم"}
        />
      </div>
      <p className="text-[11px] font-semibold text-muted">
        {num(t.campaigns)} حملة في الفترة: {num(t.completed)} مكتملة، {num(t.upcoming)} قادمة، {num(t.cancelled)} ملغاة
        {platform ? ` · ${num(t.organizers)} جهة نشطة` : ""}.
      </p>

      <Panel title="الحملات المكتملة شهرياً" hint="النمو والمواسم: كل عمود شهر، والخط عدد المتطوعين المقبولين فيه.">
        <MonthChart months={report.byMonth} />
      </Panel>

      {/* Where help is missing. */}
      <Panel
        title="وين في احتياج؟"
        hint={
          platform
            ? "مقارنة كل محافظة بالمنصة كلها. «متطوعون بلا حملات»: ناس كثيرون يسكنون فيها لكل حملة. «حملات بلا متطوعين»: مقاعد تمتلئ أقل من المعدل."
            : "مقارنة كل محافظة بمعدل حملاتكم: كثرة المتقدمين لكل مقعد، أو مقاعد تمتلئ أقل من المعدل."
        }
      >
        {needCampaigns.length || needVolunteers.length ? (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {needCampaigns.length ? (
              <div className="rounded-2xl border border-community/30 bg-community/10 p-3">
                <p className="text-xs font-black text-community-ink">🟠 متطوعون بلا حملات كافية</p>
                <p className="mt-1 text-[11px] font-bold text-ink-soft">{needCampaigns.map((g) => gov(g.governorate)).join("، ")}</p>
                <p className="mt-1 text-[10px] font-semibold text-muted">فرصة لجمعيات جديدة أو حملات أكثر هناك.</p>
              </div>
            ) : null}
            {needVolunteers.length ? (
              <div className="rounded-2xl border border-humanitarian/30 bg-humanitarian/10 p-3">
                <p className="text-xs font-black text-humanitarian-ink">🔴 حملات بلا متطوعين كافين</p>
                <p className="mt-1 text-[11px] font-bold text-ink-soft">{needVolunteers.map((g) => gov(g.governorate)).join("، ")}</p>
                <p className="mt-1 text-[10px] font-semibold text-muted">تحتاج تشجيعاً للتطوع ونشراً أوسع للحملات.</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-right text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] font-extrabold text-muted">
                <th className="py-2 pe-3">المحافظة</th>
                <th className="px-2">حملات</th>
                {platform ? <th className="px-2">يسكنها متطوعون</th> : null}
                <th className="px-2">متقدمون/مقعد</th>
                <th className="px-2">امتلاء المقاعد</th>
                <th className="px-2">مقاعد فارغة</th>
                <th className="px-2">رُفضوا</th>
                {platform ? <th className="px-2">حالات إنسانية</th> : null}
                {platform ? <th className="px-2">جهات</th> : null}
                <th className="ps-2">المؤشر</th>
              </tr>
            </thead>
            <tbody>
              {report.byGovernorate.map((g) => (
                <tr key={g.governorate} className="border-b border-line/60 font-bold text-ink">
                  <td className="py-2 pe-3 font-black">{gov(g.governorate)}</td>
                  <td className="px-2">{num(g.campaigns)}</td>
                  {platform ? <td className="px-2">{num(g.registeredVolunteers ?? 0)}</td> : null}
                  <td className="px-2">{g.applicantsPerSeat ?? "—"}</td>
                  <td className="px-2">{pct(g.fillRate)}</td>
                  <td className="px-2">{num(g.unfilledSeats)}</td>
                  <td className="px-2">{num(g.rejected)}</td>
                  {platform ? <td className="px-2">{num(g.cases ?? 0)}</td> : null}
                  {platform ? <td className="px-2">{num(g.organizers ?? 0)}</td> : null}
                  <td className="ps-2">
                    {g.signal === "NEEDS_CAMPAIGNS" ? (
                      <span className="rounded-full bg-community/15 px-2 py-0.5 text-[10px] font-black text-community-ink">
                        🟠 يحتاج حملات
                      </span>
                    ) : g.signal === "NEEDS_VOLUNTEERS" ? (
                      <span className="rounded-full bg-humanitarian/10 px-2 py-0.5 text-[10px] font-black text-humanitarian-ink">
                        🔴 يحتاج متطوعين
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="أكثر الحملات التي تُنفَّذ" hint="عدد الحملات حسب الموضوع (الحملات التي بدأت، غير الملغاة).">
          <BarList
            rows={report.byTopic.slice(0, 10).map((x) => ({
              key: x.topicId,
              label: x.nameAr,
              value: x.campaigns,
              tone: SECTION_TONE[x.sectionSlug],
              sub: `${num(x.accepted)} متطوع · امتلاء ${pct(x.fillRate)}`,
            }))}
          />
        </Panel>
        <Panel
          title="أكثر الحملات المطلوبة"
          hint="كم شخصاً تقدّم على كل مقعد: فوق 1 يعني أن الناس يريدون هذا النوع أكثر مما يُتاح."
        >
          <BarList
            rows={[...report.byTopic]
              .filter((x) => x.applicantsPerSeat !== null)
              .sort((a, b) => (b.applicantsPerSeat ?? 0) - (a.applicantsPerSeat ?? 0))
              .slice(0, 10)
              .map((x) => ({
                key: x.topicId,
                label: x.nameAr,
                value: x.applicantsPerSeat ?? 0,
                display: `${x.applicantsPerSeat} لكل مقعد`,
                tone: SECTION_TONE[x.sectionSlug],
                sub: `${num(x.applicants)} متقدم على ${num(x.seats)} مقعد · ${x.upvotesPerCampaign ?? 0} رفعة للحملة`,
              }))}
          />
        </Panel>
        <Panel title="حسب القسم">
          <BarList
            rows={report.bySection.map((x) => ({
              key: x.sectionId,
              label: x.nameAr,
              value: x.campaigns,
              tone: SECTION_TONE[x.slug],
              sub: `${num(x.accepted)} متطوع · ${x.applicantsPerSeat ?? "—"} متقدم لكل مقعد`,
            }))}
          />
        </Panel>
        <Panel title="الأثر" hint="مجموع ما وثّقته الحملات المكتملة.">
          <BarList
            rows={report.impact.slice(0, 10).map((m) => ({ key: m.label, label: m.label, value: m.total }))}
            empty="لم تُسجَّل أرقام أثر بعد."
          />
        </Panel>
      </div>

      {report.requests ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="ماذا يطلب الناس؟ طلبات النشر" hint="طلبات النشر من المستخدمين حسب القسم (والمقبول منها).">
            <BarList
              rows={report.requests.publishRequestsBySection.map((x) => ({
                key: x.sectionId,
                label: x.nameAr,
                value: x.total,
                sub: `قُبل ${num(x.approved)}`,
              }))}
              empty="لا توجد طلبات نشر في هذه الفترة."
            />
          </Panel>
          <Panel title="الحالات الإنسانية حسب النوع">
            <BarList
              rows={report.requests.casesByTopic.map((x) => ({
                key: x.topicId ?? "none",
                label: x.nameAr,
                value: x.total,
                tone: "bg-humanitarian",
              }))}
              empty="لا توجد حالات في هذه الفترة."
            />
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="المتطوعون" hint="أرقام مجمّعة فقط. الفئات الأقل من 5 أشخاص لا تُعرض.">
          <div className="mb-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-icy p-3">
              <div className="font-display text-xl font-black text-primary-ink">{num(report.volunteers.firstTime)}</div>
              <div className="text-[10px] font-bold text-muted">أول تجربة تطوع</div>
            </div>
            <div className="rounded-2xl bg-icy p-3">
              <div className="font-display text-xl font-black text-primary-ink">{num(report.volunteers.returning)}</div>
              <div className="text-[10px] font-bold text-muted">شاركوا أكثر من مرة</div>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs font-bold">
            {report.volunteers.ageGroups.map((a) => (
              <li key={a.group} className="flex justify-between">
                <span className="text-muted">{AGE_LABELS[a.group]}</span>
                <span className="text-ink">{small(a.count)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="التحصيل الدراسي">
          <ul className="space-y-1.5 text-xs font-bold">
            {report.volunteers.education.map((e) => (
              <li key={e.level} className="flex justify-between">
                <span className="text-muted">
                  {e.level === "HIDDEN"
                    ? "لم يُظهروه"
                    : e.level === "UNKNOWN"
                      ? "غير مذكور"
                      : (EDUCATION_LABELS_AR[e.level as EducationLevel] ?? e.level)}
                </span>
                <span className="text-ink">{small(e.count)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title="التقييمات"
          hint={report.ratings.average !== null ? `المعدل ${report.ratings.average} ★ من ${num(report.ratings.count)} تقييم` : "لا تقييمات بعد."}
        >
          <RatingBars distribution={report.ratings.distribution} />
        </Panel>
      </div>

      {report.topOrganizers ? (
        <Panel title="أنشط الجهات" hint="حسب الحملات المكتملة في الفترة.">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-right text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] font-extrabold text-muted">
                  <th className="py-2 pe-3">الجهة</th>
                  <th className="px-2">حملات مكتملة</th>
                  <th className="px-2">متطوعون</th>
                  <th className="px-2">جدد (أول مرة)</th>
                  <th className="ps-2">التقييم</th>
                </tr>
              </thead>
              <tbody>
                {report.topOrganizers.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 font-bold text-ink">
                    <td className="py-2 pe-3">
                      <Link href={`/users/${o.id}`} className="font-black hover:text-primary-ink hover:underline">
                        {o.name}
                      </Link>
                    </td>
                    <td className="px-2">{num(o.completed)}</td>
                    <td className="px-2">{num(o.volunteers)}</td>
                    <td className="px-2">{num(o.newVolunteers)}</td>
                    <td className="ps-2">{o.ratingAverage !== null ? `${o.ratingAverage} ★ (${num(o.ratingCount)})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import type {
  ApplicationStatus,
  BadgeView,
  EventPage,
  OrganizerApplication,
  Paginated,
} from "@/lib/types";
import { BadgeDecision, DecideForm, DocumentForm, MoveForm, StatusForm } from "./ManageForms";

export const metadata = { title: "إدارة الفعالية · واثق" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string; status?: string }>;

const TABS = [
  { key: "volunteers", label: "المتطوعون" },
  { key: "documentation", label: "التوثيق والحالة" },
  { key: "badges", label: "الشارات" },
] as const;

const STATUSES: { key: ApplicationStatus; label: string }[] = [
  { key: "PENDING", label: "بانتظار القرار" },
  { key: "ACCEPTED", label: "مقبولون" },
  { key: "REJECTED", label: "مرفوضون" },
  { key: "WITHDRAWN", label: "منسحبون" },
];

/** The organizer's page for one event: applicants, status, documentation, badges. */
export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const query = await searchParams;
  const tab = TABS.some((t) => t.key === query.tab) ? query.tab : "volunteers";
  const status = STATUSES.some((s) => s.key === query.status)
    ? (query.status as ApplicationStatus)
    : "PENDING";
  const token = await requireSessionToken();

  const eventRes = await apiFetch(`/events/${id}`, { token });
  if (eventRes.status === 404) notFound();
  if (!eventRes.ok) throw new Error(`Event failed with ${eventRes.status}`);
  const page = (await eventRes.json()) as EventPage;
  if (!page.event.isOrganizer) notFound();
  const ev = page.event;

  const href = (q: { tab?: string; status?: string }) => {
    const s = new URLSearchParams();
    s.set("tab", q.tab ?? tab ?? "volunteers");
    if ((q.tab ?? tab) === "volunteers") s.set("status", q.status ?? status);
    return `/posts/${id}/manage?${s.toString()}`;
  };
  const chip = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;

  let applications: OrganizerApplication[] = [];
  let badges: BadgeView[] = [];
  let labelSuggestions: string[] = [];
  if (tab === "volunteers") {
    const res = await apiFetch(`/events/${id}/applications?status=${status}&limit=100`, { token });
    if (res.ok) applications = ((await res.json()) as Paginated<OrganizerApplication>).data;
  } else if (tab === "badges") {
    const res = await apiFetch(`/badges/event/${id}?limit=100`, { token });
    if (res.ok) badges = ((await res.json()) as Paginated<BadgeView>).data;
  } else {
    const res = await apiFetch("/impact-labels", { token });
    if (res.ok) {
      labelSuggestions = ((await res.json()) as { data: { label: string }[] }).data.map((d) => d.label);
    }
  }

  const started = new Date(ev.startsAt) <= new Date();
  const active = ev.status === "OPEN" || ev.status === "CLOSED";

  return (
    <div className="view-pop space-y-6">
      <Link
        href={`/posts/${id}`}
        className="organic organic-sm inline-flex items-center gap-2 border border-line bg-surface px-4 py-2 text-xs font-extrabold text-ink"
      >
        <Icon name="arrow" className="h-4 w-4 rotate-180" />
        صفحة الفعالية
      </Link>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-black text-primary-ink">إدارة الفعالية</p>
          <h1 className="font-display text-xl font-black text-ink">{page.title}</h1>
          <p className="mt-1 text-xs font-semibold text-muted">{formatDateTime(ev.startsAt)}</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-icy px-4 py-3 text-center">
            <div className="font-display text-2xl font-black text-primary-ink">{ev.acceptedCount}</div>
            <div className="text-[10px] font-bold text-muted">مقبول</div>
          </div>
          {ev.capacity ? (
            <div className="rounded-2xl bg-canvas px-4 py-3 text-center">
              <div className="font-display text-2xl font-black text-ink">{ev.capacity}</div>
              <div className="text-[10px] font-bold text-muted">مقعد</div>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })} className={chip(tab === t.key)}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "volunteers" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Link
                key={s.key}
                href={href({ status: s.key })}
                className={`organic organic-sm px-4 py-1.5 text-xs ${
                  status === s.key ? "bg-navy-grad font-black text-white" : "bg-icy/70 font-extrabold text-ink"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
          {applications.length === 0 ? (
            <Card className="p-8 text-center text-sm font-bold text-muted">لا توجد طلبات هنا.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {applications.map((a) => (
                <Card key={a.id} className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.applicant.name} src={a.applicant.avatarUrl} verified={Boolean(a.applicant.verifiedKind)} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink">{a.applicant.name}</div>
                      <div className="text-[11px] font-bold text-muted">قدّم {timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    {a.applicant.age !== null ? <Fact label="العمر" value={`${a.applicant.age} سنة`} /> : null}
                    {a.applicant.address?.governorate ? (
                      <Fact
                        label="المكان"
                        value={`${a.applicant.address.city || ""} ${GOVERNORATE_LABELS_AR[a.applicant.address.governorate]}`}
                      />
                    ) : null}
                    {a.applicant.education?.level ? (
                      <Fact
                        label="التعليم"
                        value={`${EDUCATION_LABELS_AR[a.applicant.education.level]} ${a.applicant.education.fieldOfStudy}`}
                      />
                    ) : null}
                    {a.applicant.workField ? <Fact label="العمل" value={a.applicant.workField} /> : null}
                  </dl>
                  {a.roleChoices.length > 0 ? (
                    <p className="text-xs font-bold text-ink">
                      الأدوار المفضّلة:{" "}
                      <span className="text-muted">{a.roleChoices.map((c) => `${c.rank}. ${c.name}`).join("  ")}</span>
                    </p>
                  ) : null}
                  {a.role ? <p className="text-xs font-black text-environment-ink">الدور: {a.role.name}</p> : null}
                  {Object.entries(a.answers).map(([qid, answer]) => (
                    <p key={qid} className="rounded-xl bg-canvas p-2.5 text-xs font-semibold leading-6 text-ink-soft">
                      <span className="block text-[10px] font-black text-muted">
                        {ev.questions.find((q) => q.id === qid)?.text ?? qid}
                      </span>
                      {answer}
                    </p>
                  ))}
                  {a.message ? (
                    <p className="rounded-xl bg-canvas p-2.5 text-xs font-semibold leading-6 text-ink-soft">{a.message}</p>
                  ) : null}
                  {a.status === "PENDING" && active ? (
                    <DecideForm
                      eventId={id}
                      applicationId={a.id}
                      roles={ev.roles}
                      preferredRoleId={a.roleChoices[0]?.id}
                    />
                  ) : null}
                  {a.status === "ACCEPTED" && active && ev.roles.length > 1 ? (
                    <MoveForm eventId={id} applicationId={a.id} roles={ev.roles} currentRoleId={a.role?.id} />
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "documentation" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="space-y-4 p-6 lg:col-span-2">
            <h2 className="font-display text-base font-black text-ink">توثيق الفعالية</h2>
            {ev.status === "COMPLETED" ? (
              <p className="text-sm font-bold text-environment-ink">
                الفعالية موثّقة. يظهر التوثيق في صفحتها، ويستطيع المتطوعون طلب شاراتهم.
              </p>
            ) : ev.status === "CANCELLED" ? (
              <p className="text-sm font-bold text-muted">الفعالية ملغاة.</p>
            ) : !started ? (
              <p className="text-sm font-bold text-muted">يصبح التوثيق متاحاً بعد أن تبدأ الفعالية.</p>
            ) : (
              <DocumentForm eventId={id} labelSuggestions={labelSuggestions} />
            )}
          </Card>
          <div className="space-y-4">
            {ev.status === "OPEN" ? <StatusForm eventId={id} action="close" /> : null}
            {ev.status !== "CANCELLED" ? <StatusForm eventId={id} action="cancel" /> : null}
          </div>
        </div>
      ) : null}

      {tab === "badges" ? (
        badges.length === 0 ? (
          <Card className="p-8 text-center text-sm font-bold text-muted">
            {ev.status === "COMPLETED"
              ? "لا توجد طلبات شارات بعد."
              : "يطلب المتطوعون شاراتهم بعد توثيق الفعالية."}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {badges.map((b) => (
              <Card key={b.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={b.holder.name} src={b.holder.avatarUrl} />
                    <div>
                      <div className="text-sm font-black text-ink">{b.holder.name}</div>
                      <div className="text-[11px] font-bold text-muted">{b.role ? `دور: ${b.role.name}` : ""}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-icy px-3 py-1 text-[10px] font-black text-primary-ink">
                    {b.status === "REQUESTED"
                      ? "بانتظار القرار"
                      : b.status === "APPROVED"
                        ? "مُنحت"
                        : "مرفوضة"}
                  </span>
                </div>
                {b.status === "REQUESTED" && ev.status === "COMPLETED" ? (
                  <BadgeDecision eventId={id} badgeId={b.id} />
                ) : null}
              </Card>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas p-2">
      <dt className="font-bold text-muted">{label}</dt>
      <dd className="font-black text-ink">{value}</dd>
    </div>
  );
}

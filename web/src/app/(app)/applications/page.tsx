import Link from "next/link";
import { redirect } from "next/navigation";
import { GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import type { ApplicationStatus, OrganizerInboxApplication, Paginated } from "@/lib/types";
import { DecideForm } from "../posts/[id]/manage/ManageForms";

export const metadata = { title: "طلبات التطوع · واثق" };

type SearchParams = Promise<{ status?: string }>;

const STATUSES: { key: ApplicationStatus; label: string }[] = [
  { key: "PENDING", label: "بانتظار القرار" },
  { key: "ACCEPTED", label: "مقبولون" },
  { key: "REJECTED", label: "مرفوضون" },
];

/** A verified organizer's inbox: applications to all of its events, grouped by event. */
export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const status = STATUSES.some((s) => s.key === query.status)
    ? (query.status as ApplicationStatus)
    : "PENDING";
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me) redirect("/login");
  if (!me.verifiedKind) redirect("/");

  const res = await apiFetch(`/event-applications/organizer?status=${status}&limit=100`, { token });
  if (!res.ok) throw new Error(`Applications failed with ${res.status}`);
  const { data, meta } = (await res.json()) as Paginated<OrganizerInboxApplication>;

  // One group per event, in the order of its longest-waiting applicant.
  const groups = new Map<number, { event: OrganizerInboxApplication["event"]; items: OrganizerInboxApplication[] }>();
  for (const a of data) {
    const group = groups.get(a.event.id) ?? { event: a.event, items: [] };
    group.items.push(a);
    groups.set(a.event.id, group);
  }

  return (
    <div className="view-pop space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-black text-primary-ink">لوحة المنظّم</p>
          <h1 className="font-display text-xl font-black text-ink">طلبات التطوع</h1>
          <p className="mt-1 text-xs font-semibold text-muted">
            كل الطلبات على فعالياتك في مكان واحد. الأقدم أولاً حتى لا ينتظر أحد طويلاً.
          </p>
        </div>
        <div className="rounded-2xl bg-icy px-5 py-3 text-center">
          <div className="font-display text-2xl font-black text-primary-ink">{meta.total}</div>
          <div className="text-[10px] font-bold text-muted">{STATUSES.find((s) => s.key === status)?.label}</div>
        </div>
      </Card>

      <div className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        {STATUSES.map((s) => (
          <Link
            key={s.key}
            href={`/applications?status=${s.key}`}
            prefetch
            className={`organic organic-sm px-4 py-1.5 text-xs ${
              status === s.key
                ? "flipped bg-teal-grad font-black text-white shadow-sm"
                : "font-extrabold text-muted hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {groups.size === 0 ? (
        <Card className="space-y-2.5 p-10 text-center">
          <Icon name="calendar" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">
            {status === "PENDING" ? "لا توجد طلبات بانتظار قرارك" : "لا توجد طلبات هنا"}
          </p>
          <p className="text-xs font-semibold text-muted">عندما يتقدّم أحد على فعالياتك سيظهر طلبه هنا.</p>
          <ButtonLink href="/new?type=event" size="sm" className="mt-2">
            أنشئ فعالية
          </ButtonLink>
        </Card>
      ) : (
        [...groups.values()].map(({ event, items }) => {
          const active = event.status === "OPEN" || event.status === "CLOSED";
          const manage = `/posts/${event.id}/manage?tab=volunteers&status=${status}`;
          return (
            <Card key={event.id} className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/posts/${event.id}`} className="font-display text-base font-black text-ink hover:text-primary-ink">
                    {event.title}
                  </Link>
                  <p className="text-[11px] font-bold text-muted">
                    {formatDateTime(event.startsAt)} · {items.length} طلب
                  </p>
                </div>
                <ButtonLink href={manage} size="sm" variant="secondary">
                  إدارة الفعالية
                </ButtonLink>
              </div>
              <div className="divide-y divide-line/70">
                {items.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar
                        name={a.applicant.name}
                        src={a.applicant.avatarUrl}
                        verified={Boolean(a.applicant.verifiedKind)}
                      />
                      <div className="min-w-0 space-y-1">
                        <Link href={`/users/${a.applicant.id}`} className="block truncate text-sm font-black text-ink hover:text-primary-ink">
                          {a.applicant.name}
                        </Link>
                        <p className="text-[11px] font-bold text-muted">
                          قدّم {timeAgo(a.createdAt)}
                          {a.applicant.age !== null ? ` · ${a.applicant.age} سنة` : ""}
                          {a.applicant.address?.governorate
                            ? ` · ${GOVERNORATE_LABELS_AR[a.applicant.address.governorate]}`
                            : ""}
                        </p>
                        {a.roleChoices.length > 0 ? (
                          <p className="text-[11px] font-bold text-ink">
                            الأدوار المفضّلة:{" "}
                            <span className="text-muted">{a.roleChoices.map((c) => c.name).join("، ")}</span>
                          </p>
                        ) : null}
                        {a.role ? <p className="text-[11px] font-black text-environment-ink">الدور: {a.role.name}</p> : null}
                        {a.message ? (
                          <p className="rounded-xl bg-canvas p-2.5 text-xs font-semibold leading-6 text-ink-soft">{a.message}</p>
                        ) : null}
                      </div>
                    </div>
                    {a.status === "PENDING" && active ? (
                      event.hasRoles ? (
                        <ButtonLink href={manage} size="sm">
                          راجع واختر الدور
                        </ButtonLink>
                      ) : (
                        <DecideForm eventId={event.id} applicationId={a.id} roles={[]} />
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

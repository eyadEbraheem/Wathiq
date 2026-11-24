import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { decideMembershipAction } from "@/lib/actions/team";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import type { IncomingMembership, Paginated } from "@/lib/types";

export const metadata = { title: "الأعضاء وطلبات الانضمام · واثق" };

type SearchParams = Promise<{ status?: string }>;

const TABS = [
  { key: "PENDING", label: "طلبات الانضمام" },
  { key: "APPROVED", label: "الأعضاء" },
] as const;

function years(m: { startYear: number | null; endYear: number | null }): string {
  if (!m.startYear && !m.endYear) return "";
  if (m.startYear && !m.endYear) return `منذ ${m.startYear}`;
  return `${m.startYear ?? "؟"} – ${m.endYear}`;
}

/**
 * A verified account's team: people who asked to be listed as its members, and its members.
 * A request shows on the person's profile only after approval; a member can be removed later.
 */
export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const status = query.status === "APPROVED" ? "APPROVED" : "PENDING";
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me) redirect("/login");
  if (!me.verifiedKind) redirect("/");

  const res = await apiFetch(`/team-memberships/incoming?status=${status}&limit=100`, { token });
  if (!res.ok) throw new Error(`Memberships failed with ${res.status}`);
  const { data, meta } = (await res.json()) as Paginated<IncomingMembership>;

  const button = (tone: string) =>
    `organic organic-sm px-4 py-1.5 text-[11px] font-black transition ${tone}`;

  return (
    <div className="view-pop space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-black text-primary-ink">فريق {me.name}</p>
          <h1 className="font-display text-xl font-black text-ink">الأعضاء وطلبات الانضمام</h1>
          <p className="mt-1 text-xs font-semibold leading-6 text-muted">
            يطلب المتطوعون أن تظهر عضويتهم في فريقكم على ملفاتهم. تظهر العضوية بعد موافقتكم، ويمكنكم إزالتها لاحقاً.
          </p>
        </div>
        <div className="rounded-2xl bg-icy px-5 py-3 text-center">
          <div className="font-display text-2xl font-black text-primary-ink">{meta.total}</div>
          <div className="text-[10px] font-bold text-muted">{TABS.find((t) => t.key === status)?.label}</div>
        </div>
      </Card>

      <div className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/members?status=${t.key}`}
            prefetch
            className={`organic organic-sm px-4 py-1.5 text-xs ${
              status === t.key ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {data.length === 0 ? (
        <Card className="space-y-2.5 p-10 text-center">
          <Icon name="user" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">
            {status === "PENDING" ? "لا توجد طلبات انضمام بانتظاركم" : "لا يوجد أعضاء بعد"}
          </p>
          <p className="text-xs font-semibold text-muted">
            يستطيع المتطوعون طلب الانضمام عند التسجيل أو من حساباتهم، وستصلكم إشعارات بطلباتهم.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-line/70 p-2 sm:p-4">
          {data.map((m) => (
            <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={m.user.name} src={m.user.avatarUrl} verified={Boolean(m.user.verifiedKind)} />
                <div className="min-w-0 space-y-1">
                  <Link href={`/users/${m.user.id}`} className="block truncate text-sm font-black text-ink hover:text-primary-ink">
                    {m.user.name}
                  </Link>
                  <p className="text-[11px] font-bold text-muted">
                    {[m.role, years(m), status === "PENDING" ? `طلب ${timeAgo(m.createdAt)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.description ? (
                    <p className="rounded-xl bg-canvas p-2.5 text-xs font-semibold leading-6 text-ink-soft">{m.description}</p>
                  ) : null}
                </div>
              </div>
              <form action={decideMembershipAction} className="flex items-center gap-2">
                <input type="hidden" name="membershipId" value={m.id} />
                {status === "PENDING" ? (
                  <>
                    <button type="submit" name="decision" value="approve" className={button("bg-teal-grad text-white shadow-sm")}>
                      موافقة
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="reject"
                      className={button("border border-line bg-canvas text-muted hover:text-humanitarian-ink")}
                    >
                      رفض
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    name="decision"
                    value="remove"
                    className={button("border border-line bg-canvas text-muted hover:border-humanitarian/50 hover:text-humanitarian-ink")}
                  >
                    إزالة من الفريق
                  </button>
                )}
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

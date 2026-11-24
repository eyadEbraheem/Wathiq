import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { toggleBadgeVisibilityAction } from "@/lib/actions/events";
import { isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { badgeHref } from "@/lib/links";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type { BadgeView, Paginated } from "@/lib/types";

export const metadata = { title: "شاراتي · واثق" };

const STATUS: Record<BadgeView["status"], { text: string; tone: string }> = {
  APPROVED: { text: "مُنحت", tone: "bg-environment/10 text-environment-ink" },
  REQUESTED: { text: "بانتظار المنظّم", tone: "bg-community/15 text-community-ink" },
  REJECTED: { text: "لم تُمنح", tone: "bg-humanitarian/10 text-humanitarian-ink" },
  REVOKED: { text: "سُحبت", tone: "bg-canvas text-muted" },
};

/** The caller's badges and attendance certificates, with the CV link. */
export default async function BadgesPage() {
  const token = await requireSessionToken();
  // Badges and the volunteer CV are for people; organizations do not volunteer.
  if (isOrganization(await fetchCurrentUser(token))) redirect("/me");
  const res = await apiFetch("/badges/me?limit=100", { token });
  if (!res.ok) throw new Error(`Badges failed with ${res.status}`);
  const badges = ((await res.json()) as Paginated<BadgeView>).data;
  const approved = badges.filter((b) => b.status === "APPROVED").length;

  return (
    <div className="view-pop space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="font-display text-xl font-black text-ink">شاراتي وشهاداتي</h1>
          <p className="text-xs font-semibold text-muted">
            تحصل على شارة (أو شهادة حضور في القسم التعليمي) بعد كل فعالية شاركت فيها ووثّقها منظّمها.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-icy px-4 py-3 text-center">
            <div className="font-display text-2xl font-black text-primary-ink">{approved}</div>
            <div className="text-[10px] font-bold text-muted">ممنوحة</div>
          </div>
          <ButtonLink href="/cv">
            <Icon name="user" className="h-4 w-4" />
            سيرتي التطوعية
          </ButtonLink>
        </div>
      </Card>

      {badges.length === 0 ? (
        <Card className="space-y-3 p-10 text-center">
          <Icon name="shield" className="mx-auto h-10 w-10 text-primary" />
          <p className="text-sm font-black text-ink">لا توجد شارات بعد</p>
          <p className="text-xs font-semibold text-muted">تطوّع في فعالية، وبعد توثيقها اطلب شارتك من صفحتها.</p>
          <ButtonLink href="/events" size="sm" className="mt-2">
            تصفّح الفعاليات
          </ButtonLink>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {badges.map((b) => {
            const look = sectionLook(b.event.section.slug);
            return (
              <Card key={b.id} className="relative space-y-4 p-5 transition hover:border-primary/50">
                <div className="flex items-start gap-3">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${look.solid}`}>
                    <Icon name={look.icon} className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[10px] font-black ${look.text}`}>
                      {b.kind === "CERTIFICATE" ? "شهادة حضور" : "شارة تطوع"} · {b.event.section.nameAr}
                    </span>
                    <h2 className="font-display text-sm font-black leading-6 text-ink">
                      {/* The whole card opens the event's documentation (the link stretches over it). */}
                      <Link
                        href={badgeHref(b.event.id)}
                        className="after:absolute after:inset-0 after:rounded-[inherit] hover:text-primary-ink"
                      >
                        {b.event.title}
                      </Link>
                    </h2>
                    <p className="text-[11px] font-semibold text-muted">
                      {b.event.organizer.name} · {formatDay(b.event.startsAt)}
                      {b.role ? ` · ${b.role.name}` : ""}
                    </p>
                  </div>
                </div>
                {b.description ? (
                  <p className="rounded-2xl bg-canvas p-3 text-xs font-semibold leading-6 text-ink-soft">
                    «{b.description}»
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${STATUS[b.status].tone}`}>
                    {STATUS[b.status].text}
                  </span>
                  {b.status === "APPROVED" ? (
                    <form action={toggleBadgeVisibilityAction} className="relative z-10">
                      <input type="hidden" name="badgeId" value={b.id} />
                      <input type="hidden" name="show" value={String(!b.isShownOnProfile)} />
                      <button
                        type="submit"
                        className="organic organic-sm border border-line bg-canvas px-3 py-1.5 text-[11px] font-extrabold text-muted hover:text-ink"
                      >
                        {b.isShownOnProfile ? "إخفاء من ملفي" : "إظهار في ملفي"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

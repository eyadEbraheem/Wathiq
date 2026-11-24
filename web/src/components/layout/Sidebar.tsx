import Link from "next/link";
import { NavLink } from "@/components/layout/NavLink";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { logoutAction } from "@/lib/actions/auth";
import { isFrozen, isOrganization } from "@/lib/accounts";
import type { CurrentUser } from "@/lib/types";

/** Brand: the round "و" emblem and the name. */
export function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-3.5" aria-label="واثق، الصفحة الرئيسية">
      <span className="emblem flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-2xl font-black text-white transition group-hover:scale-105">
        و
      </span>
      <span>
        <span className="block font-display text-lg font-black leading-tight text-ink">واثق</span>
        <span className="block text-[11px] font-extrabold tracking-wide text-primary-ink">
          منصة العمل المدني والتطوع
        </span>
      </span>
    </Link>
  );
}

function roleLabel(user: CurrentUser): string {
  if (user.role === "ADMIN") return "مدير المنصة";
  if (user.verifiedKind === "ORGANIZATION") return "منظمة موثّقة";
  if (user.verifiedKind === "INDIVIDUAL") return "حساب موثّق";
  return "متطوّع";
}

/** The right-hand sidebar of the reference: brand, who is signed in, navigation, actions. */
export function Sidebar({ user, unread }: { user: CurrentUser | null; unread: number }) {
  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <Brand />

        {user ? (
          <Link
            href="/me"
            className="flex items-center justify-between gap-2.5 rounded-2xl border border-line bg-icy/80 p-3 transition hover:border-primary/60"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar name={user.name} src={user.avatarUrl} verified={Boolean(user.verifiedKind)} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-ink">{user.name}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary-ink">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  {roleLabel(user)}
                </span>
              </span>
            </span>
          </Link>
        ) : (
          <div className="space-y-2 rounded-2xl border border-line bg-icy/80 p-3">
            <p className="text-xs font-bold leading-6 text-ink-soft">
              انضم إلى واثق لتتطوع وتتابع المبادرات من حولك.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/register" size="sm">
                انضم إلينا
              </ButtonLink>
              <ButtonLink href="/login" size="sm" variant="secondary">
                دخول
              </ButtonLink>
            </div>
          </div>
        )}

        <nav className="space-y-1.5" aria-label="التنقل الرئيسي">
          <div className="px-2 pb-1 text-[10px] font-extrabold tracking-wider text-muted/80">
            تصفّح واثق
          </div>
          <NavLink href="/" icon="home" iconTone="bg-icy text-primary-ink" label="الرئيسية" />
          <NavLink
            href="/events"
            icon="calendar"
            iconTone="bg-environment/10 text-environment"
            label="الفعاليات التطوعية"
          />
          <NavLink
            href="/highlights"
            icon="star"
            iconTone="bg-community/15 text-community"
            label="جمعية الأسبوع"
          />
          {user ? (
            <NavLink
              href="/organizations"
              icon="building"
              iconTone="bg-community/15 text-community"
              label="الجمعيات"
            />
          ) : null}
          {user ? (
            <NavLink
              href="/search"
              icon="search"
              iconTone="bg-icy text-primary-ink"
              label="البحث"
            />
          ) : null}
          {user ? (
            <>
              <NavLink
                href="/notifications"
                icon="bell"
                iconTone="bg-education/10 text-education"
                label="الإشعارات"
                count={unread > 0 ? unread : undefined}
              />
              <NavLink
                href="/me"
                icon="user"
                iconTone="bg-community/15 text-community"
                label={isOrganization(user) ? "حساب الجمعية" : "حسابي واهتماماتي"}
              />
              {/* Badges and the CV are a volunteer's; organizations do not volunteer. */}
              {!isOrganization(user) ? (
                <NavLink
                  href="/badges"
                  icon="shield"
                  iconTone="bg-animal-welfare/10 text-animal-welfare"
                  label="شاراتي وسيرتي"
                />
              ) : null}
              {user.verifiedKind ? (
                <NavLink
                  href="/members"
                  icon="user"
                  iconTone="bg-community/15 text-community"
                  label="الأعضاء وطلبات الانضمام"
                />
              ) : null}
              {user.verifiedKind ? (
                <NavLink
                  href="/stats"
                  icon="chart"
                  iconTone="bg-education/10 text-education"
                  label="إحصائيات حملاتنا"
                />
              ) : null}
              {user.verifiedKind ? (
                <NavLink
                  href="/my-posts"
                  icon="grid"
                  iconTone="bg-primary/10 text-primary-ink"
                  label="منشوراتي ومبادراتي"
                />
              ) : null}
              {user.verifiedKind ? (
                <NavLink
                  href="/applications"
                  icon="calendar"
                  iconTone="bg-environment/10 text-environment"
                  label="طلبات التطوع"
                />
              ) : null}
              {user.role !== "ADMIN" && !isFrozen(user) ? (
              <NavLink
                href="/requests"
                icon="plus"
                iconTone="bg-humanitarian/10 text-humanitarian"
                label={user.verifiedKind ? "طلبات النشر الواردة" : "اطلب نشر مبادرة"}
              />
              ) : null}
              {!user.verifiedKind && user.role !== "ADMIN" ? (
                <NavLink
                  href="/verify"
                  icon="shield"
                  iconTone="bg-environment/10 text-environment"
                  label={isFrozen(user) ? "توثيق الجمعية" : "توثيق حسابي"}
                />
              ) : null}
            </>
          ) : null}
          {user?.role === "ADMIN" ? (
            <NavLink
              href="/admin"
              icon="sliders"
              iconTone="bg-animal-welfare/10 text-animal-welfare"
              label="لوحة الإدارة"
            />
          ) : null}
          {user?.role === "ADMIN" ? (
            <NavLink
              href="/admin/stats"
              icon="chart"
              iconTone="bg-education/10 text-education"
              label="إحصائيات المنصة"
            />
          ) : null}
        </nav>
      </div>

      {user ? (
        <div className="space-y-2.5 border-t border-line p-4">
          {user.verifiedKind ? (
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/new" size="sm">
                <Icon name="plus" className="h-4 w-4" />
                منشور
              </ButtonLink>
              <ButtonLink href="/new?type=event" size="sm" variant="secondary">
                <Icon name="calendar" className="h-4 w-4" />
                فعالية
              </ButtonLink>
            </div>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              className="organic organic-sm flex w-full items-center justify-center gap-2 border border-line bg-canvas px-3 py-2.5 text-[11px] font-extrabold text-ink hover:border-humanitarian/50 hover:text-humanitarian-ink"
            >
              <Icon name="logout" className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

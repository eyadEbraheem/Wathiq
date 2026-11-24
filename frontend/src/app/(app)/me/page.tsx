import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { isOrganization } from "@/lib/accounts";
import { logoutAction } from "@/lib/actions/auth";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type { Interests, OrganizerStats, Paginated, Section, VolunteerCv } from "@/lib/types";
import { AccountForm } from "./AccountForm";
import { AvatarForm } from "./AvatarForm";
import { PrivacyForm } from "./PrivacyForm";
import { ProfileForm } from "./ProfileForm";
import { SpecialtiesForm } from "./SpecialtiesForm";

export const metadata = { title: "حسابي · واثق" };

export default async function MePage() {
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  if (!user) redirect("/login");

  // An organization sees what it runs; a person sees their volunteering.
  const organization = isOrganization(user);
  const [sectionsRes, interestsRes, statsRes, specialtiesRes] = await Promise.all([
    apiFetch("/sections?limit=100", { token }),
    apiFetch("/users/me/interests", { token }),
    organization
      ? apiFetch(`/users/${user.id}/organizer-stats`, { token })
      : apiFetch("/users/me/cv", { token }),
    user.verifiedKind ? apiFetch("/users/me/specialties", { token }) : null,
  ]);
  // Verified accounts list specialties that people search by.
  const specialties = specialtiesRes?.ok
    ? ((await specialtiesRes.json()) as { data: { name: string }[] }).data.map((s) => s.name)
    : null;
  if (!sectionsRes.ok || !interestsRes.ok) throw new Error("Could not load interests.");
  const sections = ((await sectionsRes.json()) as Paginated<Section>).data;
  const interests = (await interestsRes.json()) as Interests;
  // The indicators; the page still works if they fail.
  const stats = !organization && statsRes.ok ? ((await statsRes.json()) as VolunteerCv).stats : null;
  const orgStats = organization && statsRes.ok ? ((await statsRes.json()) as OrganizerStats) : null;

  const sectionNames = sections.filter((s) => interests.sectionIds.includes(s.id));
  const topicNames = sections
    .flatMap((s) => s.topics)
    .filter((t) => interests.topicIds.includes(t.id));
  const primary = sections.find((s) => s.id === interests.primarySectionId);

  const shortcuts: { href: string; label: string; icon: IconName }[] = organization
    ? [
        { href: `/users/${user.id}`, label: "صفحة الجمعية كما يراها الناس", icon: "user" },
        { href: "/new?type=event", label: "فعالية جديدة", icon: "calendar" },
        { href: "/applications", label: "طلبات التطوع", icon: "user" },
        { href: "/requests", label: "طلبات النشر الواردة", icon: "plus" },
        { href: "/members", label: "الأعضاء وطلبات الانضمام", icon: "user" },
      ]
    : [
        { href: `/users/${user.id}`, label: "ملفي كما يراه الناس", icon: "user" },
        { href: "/badges", label: "شاراتي", icon: "shield" },
        { href: "/cv", label: "سيرتي التطوعية", icon: "school" },
        ...(user.verifiedKind
          ? [{ href: "/requests", label: "طلبات النشر الواردة", icon: "plus" as IconName }]
          : user.role !== "ADMIN"
            ? [{ href: "/verify", label: "توثيق حسابي", icon: "shield" as IconName }]
            : []),
      ];

  return (
    <div className="view-pop mx-auto max-w-4xl space-y-5">
      <Card className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar name={user.name} src={user.avatarUrl} verified={Boolean(user.verifiedKind)} size="lg" />
            <AvatarForm hasPhoto={Boolean(user.avatarUrl)} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-black text-ink">{user.name}</h1>
            <p className="text-xs font-semibold text-muted" dir="ltr">
              {user.email ?? user.phone}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.verifiedKind ? (
                <Badge tone="primary">{user.verifiedKind === "ORGANIZATION" ? "منظمة موثّقة" : "حساب موثّق"}</Badge>
              ) : user.role !== "ADMIN" ? (
                <Badge>حساب عادي</Badge>
              ) : null}
              {user.role === "ADMIN" ? <Badge tone="animal-welfare">مدير المنصة</Badge> : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="organic organic-sm flex items-center gap-2 border border-line bg-canvas p-3 text-xs font-extrabold text-ink hover:border-primary"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-icy text-primary-ink">
                <Icon name={s.icon} className="h-4 w-4" />
              </span>
              {s.label}
            </Link>
          ))}
        </div>
        {stats ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="organic organic-sm bg-teal-grad p-4 text-center text-white shadow-glow">
              <Icon name="clock" className="mx-auto h-5 w-5 opacity-90" />
              <div className="mt-1 font-display text-2xl font-black">{stats.volunteerHours}</div>
              <div className="text-[10px] font-bold opacity-90">ساعة تطوع</div>
            </div>
            <div className="organic organic-sm border border-line bg-canvas p-4 text-center">
              <Icon name="calendar" className="mx-auto h-5 w-5 text-primary-ink" />
              <div className="mt-1 font-display text-2xl font-black text-ink">{stats.completedEvents}</div>
              <div className="text-[10px] font-bold text-muted">فعالية شاركت فيها</div>
            </div>
            <div className="organic organic-sm border border-line bg-canvas p-4 text-center">
              <Icon name="shield" className="mx-auto h-5 w-5 text-primary-ink" />
              <div className="mt-1 font-display text-2xl font-black text-ink">{stats.approvedBadges}</div>
              <div className="text-[10px] font-bold text-muted">شارة وشهادة</div>
            </div>
          </div>
        ) : null}
        {orgStats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="organic organic-sm bg-teal-grad p-4 text-center text-white shadow-glow">
                <Icon name="calendar" className="mx-auto h-5 w-5 opacity-90" />
                <div className="mt-1 font-display text-2xl font-black">{orgStats.completedEvents}</div>
                <div className="text-[10px] font-bold opacity-90">فعالية مكتملة</div>
              </div>
              <div className="organic organic-sm border border-line bg-canvas p-4 text-center">
                <Icon name="user" className="mx-auto h-5 w-5 text-primary-ink" />
                <div className="mt-1 font-display text-2xl font-black text-ink">{orgStats.acceptedVolunteers}</div>
                <div className="text-[10px] font-bold text-muted">متطوع شارك معنا</div>
              </div>
              <div className="organic organic-sm border border-line bg-canvas p-4 text-center">
                <Icon name="shield" className="mx-auto h-5 w-5 text-primary-ink" />
                <div className="mt-1 font-display text-2xl font-black text-ink">
                  {orgStats.rating.average !== null ? `${orgStats.rating.average} ★` : "—"}
                </div>
                <div className="text-[10px] font-bold text-muted">
                  {orgStats.rating.hidden
                    ? "التقييم مخفي عن الناس"
                    : orgStats.rating.enoughRatings
                      ? `من ${orgStats.rating.count} تقييمات`
                      : "يظهر من 3 تقييمات"}
                </div>
              </div>
            </div>
            {orgStats.impact.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {orgStats.impact.map((m) => (
                  <span key={m.label} className="rounded-full bg-icy px-3 py-1 text-[11px] font-black text-primary-ink">
                    {m.total} {m.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {!user.onboardingCompletedAt ? (
        <Card className="flex flex-wrap items-center gap-3 p-5">
          <p className="flex-1 text-sm font-bold text-ink">
            {organization ? "لم تختر أقسام عمل الجمعية بعد." : "لم تختر اهتماماتك بعد."}
          </p>
          <ButtonLink href="/onboarding" size="sm">
            اختر اهتماماتك
          </ButtonLink>
        </Card>
      ) : null}

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-black text-ink">{organization ? "أقسام عملنا" : "اهتماماتي"}</h2>
          <ButtonLink href="/onboarding?next=/me" variant="secondary" size="sm">
            تعديل
          </ButtonLink>
        </div>
        {sectionNames.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {sectionNames.map((s) => {
                const look = sectionLook(s.slug);
                return (
                  <span
                    key={s.id}
                    className={`organic organic-sm flex items-center gap-1.5 border-2 px-3 py-1.5 text-xs font-black text-ink ${
                      s.id === primary?.id ? `flipped ${look.chosen}` : look.soft
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${look.solid}`} />
                    {s.nameAr}
                    {s.id === primary?.id ? " · الرئيسي" : ""}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topicNames.map((t) => (
                <span key={t.id} className="rounded-full bg-icy px-3 py-1 text-[11px] font-bold text-primary-ink">
                  {t.nameAr}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-muted">لا توجد اهتمامات بعد.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="font-display text-lg font-black text-ink">الملف الشخصي</h2>
          <p className="mt-1 text-xs font-semibold text-muted">كل الحقول اختيارية ما عدا الاسم.</p>
          <ProfileForm user={user} />
        </Card>
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-black text-ink">الخصوصية</h2>
          <p className="mt-1 text-xs font-semibold leading-6 text-muted">
            {organization
              ? "ما يراه الآخرون في صفحة الجمعية، وما تستقبله منهم."
              : "ما يراه الآخرون في ملفك. إذا كان عمرك أقل من 18 سنة تبقى هذه المعلومات مخفية دائماً."}
          </p>
          <PrivacyForm user={user} />
        </Card>
      </div>

      {specialties ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-black text-ink">الاختصاصات</h2>
          <p className="mt-1 text-xs font-semibold leading-6 text-muted">
            ما تعمل عليه بالتحديد، مثل «تسرّب الأطفال». يجدك الناس بها في البحث، وتظهر في صفحتك.
          </p>
          <SpecialtiesForm initial={specialties} />
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="font-display text-lg font-black text-ink">الحساب والخصوصية</h2>
        <p className="mt-1 text-xs font-semibold leading-6 text-muted">
          بيانات الدخول إلى حسابك. لا تظهر لأحد غيرك.
        </p>
        <AccountForm user={user} />
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary" className="w-full">
          تسجيل الخروج
        </Button>
      </form>
    </div>
  );
}

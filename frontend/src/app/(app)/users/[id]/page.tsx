import Link from "next/link";
import { notFound } from "next/navigation";
import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR } from "@csh/shared";
import { FeedCard } from "@/components/feed/FeedCard";
import { ReportButton } from "@/components/social/ReportButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { toggleFollowAction } from "@/lib/actions/social";
import { isFrozen, isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { badgeHref } from "@/lib/links";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type {
  BadgeView,
  OrganizerStats,
  Paginated,
  PostView,
  ProfileTeam,
  PublicProfileView,
  TeamMember,
  UserCard,
} from "@/lib/types";

type Params = Promise<{ id: string }>;

export const metadata = { title: "الملف الشخصي · واثق" };

async function json<T>(res: Response): Promise<T | null> {
  return res.ok ? ((await res.json()) as T) : null;
}

/**
 * A user's public profile. Verified accounts also show their numbers (completed events,
 * volunteers, impact, rating), specialties and latest posts; everyone shows approved badges
 * and teams they chose to show.
 */
export default async function ProfilePage({ params }: { params: Params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);

  const profileRes = await apiFetch(`/users/${id}`, { token });
  if (profileRes.status === 404) notFound();
  if (!profileRes.ok) throw new Error(`Profile failed with ${profileRes.status}`);
  const profile = (await profileRes.json()) as PublicProfileView;
  const verified = Boolean(profile.verifiedKind);

  const [stats, posts, badges, teams, following, members] = await Promise.all([
    verified ? apiFetch(`/users/${id}/organizer-stats`, { token }).then(json<OrganizerStats>) : null,
    verified
      ? apiFetch(`/posts?authorId=${id}&limit=6`, { token }).then(json<Paginated<PostView>>)
      : null,
    apiFetch(`/badges/user/${id}?limit=50`, { token }).then(json<Paginated<BadgeView>>),
    apiFetch(`/users/${id}/teams?limit=20`, { token }).then(json<Paginated<ProfileTeam>>),
    verified && me && me.id !== id
      ? apiFetch("/users/me/following?limit=100", { token }).then(json<Paginated<UserCard>>)
      : null,
    // A verified account's approved members (adults who show their teams).
    verified ? apiFetch(`/users/${id}/members?limit=24`, { token }).then(json<Paginated<TeamMember>>) : null,
  ]);
  const isFollowing = Boolean(following?.data.some((u) => u.id === id));

  const place = profile.address?.governorate
    ? [profile.address.city, GOVERNORATE_LABELS_AR[profile.address.governorate]].filter(Boolean).join("، ")
    : null;

  return (
    <div className="view-pop space-y-6">
      <Card className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} src={profile.avatarUrl} verified={verified} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-black text-ink">{profile.name}</h1>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {profile.isOfficial ? <Badge tone="primary">الحساب الرسمي لواثق</Badge> : null}
                {profile.verifiedKind === "ORGANIZATION" ? <Badge tone="primary">منظمة موثّقة</Badge> : null}
                {profile.verifiedKind === "INDIVIDUAL" ? <Badge tone="primary">حساب موثّق</Badge> : null}
                {profile.isPartner ? <Badge tone="community">شريك</Badge> : null}
                {stats && stats.weeklyHighlights > 0 ? (
                  <Link href="/highlights" className="rounded-full hover:opacity-80">
                    <Badge tone="community">
                      ⭐ جمعية الأسبوع
                      {stats.weeklyHighlights > 1 ? ` × ${stats.weeklyHighlights}` : ""}
                    </Badge>
                  </Link>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-muted">
                {[
                  place,
                  profile.age !== null ? `${profile.age} سنة` : null,
                  profile.foundedYear ? `تأسست عام ${profile.foundedYear}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {me && me.id !== id ? (
            <div className="flex flex-wrap items-center gap-3">
              <ReportButton target="USER" targetId={id} label="إبلاغ عن الحساب" />
              {verified && !me.verifiedKind ? (
                <Link
                  href={`/requests?to=${id}`}
                  className="organic organic-sm border border-primary/30 bg-icy px-4 py-2 text-xs font-black text-primary-ink"
                >
                  اطلب منه النشر
                </Link>
              ) : null}
          {verified ? (
            <form action={toggleFollowAction}>
              <input type="hidden" name="userId" value={id} />
              <input type="hidden" name="following" value={String(isFollowing)} />
              <button
                type="submit"
                className={`organic px-6 py-2.5 text-sm font-black ${
                  isFollowing ? "border border-line bg-canvas text-muted" : "bg-teal-grad text-white shadow-glow"
                }`}
              >
                {isFollowing ? "إلغاء المتابعة" : "متابعة"}
              </button>
            </form>
          ) : null}
            </div>
          ) : null}
        </div>

        {profile.bio ? <p className="text-sm font-medium leading-8 text-ink-soft">{profile.bio}</p> : null}

        {profile.education || profile.workField ? (
          <div className="flex flex-wrap gap-2 text-xs font-bold text-muted">
            {profile.education?.level ? (
              <span className="rounded-full bg-canvas px-3 py-1">
                {EDUCATION_LABELS_AR[profile.education.level]} {profile.education.fieldOfStudy}
              </span>
            ) : null}
            {profile.workField ? <span className="rounded-full bg-canvas px-3 py-1">{profile.workField}</span> : null}
          </div>
        ) : null}

        {profile.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.specialties.map((s) => (
              <span key={s.id} className="rounded-full bg-icy px-3 py-1 text-xs font-black text-primary-ink">
                {s.name}
              </span>
            ))}
          </div>
        ) : null}

        {stats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={String(stats.completedEvents)} label="فعالية مكتملة" />
            <Stat value={String(stats.acceptedVolunteers)} label="متطوع شارك" />
            {stats.impact.slice(0, 1).map((m) => (
              <Stat key={m.label} value={String(m.total)} label={m.label} />
            ))}
            <Stat
              value={
                stats.rating.hidden
                  ? "—"
                  : stats.rating.average !== null
                    ? `${stats.rating.average} ★`
                    : "—"
              }
              label={
                stats.rating.hidden
                  ? "التقييم مخفي"
                  : stats.rating.enoughRatings
                    ? `من ${stats.rating.count} تقييمات`
                    : "لا تقييمات كافية بعد"
              }
            />
          </div>
        ) : null}
        {stats && stats.impact.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {stats.impact.slice(1).map((m) => (
              <span key={m.label} className="rounded-full bg-environment/10 px-3 py-1 text-xs font-black text-environment-ink">
                {m.total} {m.label}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      {badges && badges.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-ink">الشارات</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {badges.data.map((b) => {
              const look = sectionLook(b.event.section.slug);
              return (
                <Link key={b.id} href={badgeHref(b.event.id)} className="block">
                  <Card className="flex items-center gap-3 p-4 transition hover:border-primary/50">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${look.solid}`}>
                      <Icon name={look.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-ink">{b.event.title}</div>
                      <div className="text-[11px] font-semibold text-muted">
                        {b.kind === "CERTIFICATE" ? "شهادة حضور" : "شارة"} · {b.event.organizer.name} ·{" "}
                        {formatDay(b.event.startsAt)}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {members && members.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-ink">
            الأعضاء <span className="text-sm text-muted">({members.meta.total})</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.data.map((m) => (
              <Link key={m.id} href={`/users/${m.user.id}`} className="block">
                <Card className="flex items-center gap-3 p-4 transition hover:border-primary/50">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} verified={Boolean(m.user.verifiedKind)} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-ink">{m.user.name}</div>
                    {m.role ? <div className="truncate text-[11px] font-semibold text-muted">{m.role}</div> : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {teams && teams.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-ink">الفرق</h2>
          <div className="flex flex-wrap gap-2">
            {teams.data.map((t) => (
              <span key={t.id} className="rounded-2xl border border-line bg-surface px-4 py-2 text-xs font-bold text-ink">
                {t.team.name}
                {t.role ? <span className="text-muted"> · {t.role}</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {posts && posts.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-ink">آخر المنشورات والفعاليات</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.data.map((p) => (
              <FeedCard key={p.id} post={p} back={`/users/${id}`} canVolunteer={!isOrganization(me)} readOnly={isFrozen(me)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-icy p-3 text-center">
      <div className="font-display text-xl font-black text-primary-ink">{value}</div>
      <div className="text-[11px] font-bold text-muted">{label}</div>
    </div>
  );
}

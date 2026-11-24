import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GOVERNORATE_LABELS_AR } from "@csh/shared";
import { BackLink } from "@/components/layout/BackLink";
import { ScrollToHash } from "@/components/layout/ScrollToHash";
import { ReportButton } from "@/components/social/ReportButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { deleteCommentAction } from "@/lib/actions/comments";
import { toggleUpvoteAction } from "@/lib/actions/posts";
import { isFrozen, isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDateTime, formatDay, formatHours, timeAgo } from "@/lib/format";
import { sectionLook } from "@/lib/sections";
import { requireSessionToken } from "@/lib/session";
import type {
  ApplicationStatus,
  BadgeView,
  CommentView,
  EventPage,
  Paginated,
  PostView,
} from "@/lib/types";
import { RateForm, RequestBadgeForm } from "./AfterEventForms";
import { ApplyForm } from "./ApplyForm";
import { CommentForm } from "./CommentForm";
import { WithdrawForm } from "./WithdrawForm";

type Params = Promise<{ id: string }>;

const APPLICATION_LABEL: Record<ApplicationStatus, { text: string; tone: string }> = {
  PENDING: { text: "طلبك قيد المراجعة", tone: "bg-community/15 text-community-ink" },
  ACCEPTED: { text: "تم قبولك", tone: "bg-environment/10 text-environment-ink" },
  REJECTED: { text: "لم يُقبل طلبك هذه المرة", tone: "bg-humanitarian/10 text-humanitarian-ink" },
  WITHDRAWN: { text: "سحبت طلبك", tone: "bg-canvas text-muted" },
};

const EVENT_STATUS: Record<EventPage["event"]["status"], string> = {
  OPEN: "التسجيل مفتوح",
  CLOSED: "التسجيل مغلق",
  COMPLETED: "اكتملت ووُثّقت",
  CANCELLED: "أُلغيت",
};

export async function generateMetadata({ params }: { params: Params }) {
  return { title: `منشور ${(await params).id} · واثق` };
}

export default async function PostPage({ params }: { params: Params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me) redirect("/login");

  const res = await apiFetch(`/posts/${id}`, { token });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Post failed with ${res.status}`);
  const post = (await res.json()) as PostView;

  let event: EventPage | null = null;
  if (post.kind === "EVENT") {
    const evRes = await apiFetch(`/events/${id}`, { token });
    if (!evRes.ok) throw new Error(`Event failed with ${evRes.status}`);
    event = (await evRes.json()) as EventPage;
  }

  const commentsRes = await apiFetch(`/posts/${id}/comments?limit=50`, { token });
  const comments = commentsRes.ok
    ? ((await commentsRes.json()) as Paginated<CommentView>).data
    : [];

  // After a documented event: the volunteer's badge for this participation, if requested.
  let myBadge: BadgeView | null = null;
  const myApp = event?.myApplication;
  if (event?.event.status === "COMPLETED" && myApp?.status === "ACCEPTED") {
    const badgesRes = await apiFetch("/badges/me?limit=100", { token });
    if (badgesRes.ok) {
      const list = ((await badgesRes.json()) as Paginated<BadgeView>).data;
      myBadge = list.find((b) => b.applicationId === myApp.id) ?? null;
    }
  }
  const ratingOpen =
    event?.event.documentedAt !== null &&
    event?.event.documentedAt !== undefined &&
    Date.now() < new Date(event.event.documentedAt).getTime() + 30 * 24 * 60 * 60 * 1000;

  const look = sectionLook(post.section.slug);
  const ev = event?.event ?? null;
  const cover = post.media[0]?.url;
  const percent =
    ev && ev.capacity ? Math.min(100, Math.round((ev.acceptedCount / ev.capacity) * 100)) : 0;
  const mine = event?.myApplication ?? null;
  // Organizations do not volunteer (the API refuses them too).
  const organization = isOrganization(me);
  // An organization waiting for verification can only look.
  const frozen = isFrozen(me);
  const canApply =
    Boolean(ev?.applicationsOpen) &&
    !ev?.isOrganizer &&
    !organization &&
    (!mine || mine.status === "WITHDRAWN");
  const canDeleteComment = (c: CommentView) =>
    c.author.id === me.id || post.author.id === me.id || me.role === "ADMIN";

  return (
    <div className="view-pop space-y-6">
      <ScrollToHash />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink
          href={`/?section=${post.section.id}&sort=newest`}
          matches="/"
          className="organic organic-sm flex items-center gap-2 border border-line bg-surface px-4 py-2 text-xs font-extrabold text-ink"
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" />
          العودة لقسم {post.section.nameAr}
        </BackLink>
        <div className="flex items-center gap-3">
          {post.author.id !== me.id && !frozen ? <ReportButton target="POST" targetId={post.id} /> : null}
          <form action={toggleUpvoteAction}>
          <input type="hidden" name="postId" value={post.id} />
          <input type="hidden" name="upvoted" value={String(post.upvotedByMe)} />
          <input type="hidden" name="back" value={`/posts/${post.id}`} />
          <button
            type="submit"
            aria-pressed={post.upvotedByMe}
            disabled={frozen}
            title={frozen ? "متاح بعد توثيق الجمعية" : undefined}
            className={`organic organic-sm flex items-center gap-1.5 px-4 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${
              post.upvotedByMe
                ? "border border-primary/40 bg-icy text-primary-ink"
                : "border border-line bg-surface text-muted"
            }`}
          >
            <Icon name="up" className="h-4 w-4" strokeWidth={2.6} />
            رفع ({post.upvoteCount})
          </button>
          </form>
        </div>
      </div>

      <article className="overflow-hidden rounded-panel border border-line/80 bg-surface shadow-soft">
        <div className="relative h-64 w-full overflow-hidden bg-navy-grad sm:h-80">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center ${look.solid}`}>
              <Icon name={look.icon} className="h-24 w-24 opacity-70" strokeWidth={1.4} />
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-[#13263A]/85 via-[#13263A]/25 to-transparent" />
          <div className="absolute right-5 top-5 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-4 py-1.5 text-xs font-black shadow ${look.solid}`}>
              {post.section.nameAr}
            </span>
            {post.topics.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-primary-dark shadow"
              >
                {t.nameAr}
              </span>
            ))}
            {ev ? (
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-extrabold text-primary-dark shadow">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {EVENT_STATUS[ev.status]}
              </span>
            ) : null}
          </div>
          <div className="absolute inset-x-6 bottom-6 flex flex-col justify-between gap-4 text-white md:flex-row md:items-end">
            <div>
              <div className="mb-1 text-xs font-extrabold text-primary-light">
                {post.author.name}
                {post.author.verifiedKind ? " ✓" : ""}
                {post.creditedUser ? ` · بطلب من ${post.creditedUser.name}` : ""}
              </div>
              <h1 className="font-display text-2xl font-black leading-tight sm:text-3xl">{post.title}</h1>
            </div>
            {canApply ? (
              <a
                href="#apply"
                className="organic flex shrink-0 items-center justify-center gap-2 bg-teal-grad px-8 py-3.5 text-sm font-black text-white shadow-glow"
              >
                تطوع الآن
                <Icon name="arrow" className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-7 p-6 sm:p-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {ev ? (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-canvas p-4">
                  <div className="text-[11px] font-bold text-muted">الموعد</div>
                  <div className="mt-1 text-xs font-black text-ink">{formatDateTime(ev.startsAt)}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-primary-ink">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    {formatHours(ev.volunteerHours)} تطوع
                  </div>
                  {ev.applicationDeadline ? (
                    <div className="mt-1 text-[11px] font-bold text-muted">
                      آخر موعد للتقديم: {formatDay(ev.applicationDeadline)}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-line bg-canvas p-4">
                  <div className="text-[11px] font-bold text-muted">المكان</div>
                  <div className="mt-1 text-xs font-black text-ink">
                    {ev.locationText || ev.city}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-muted">
                    {ev.city}، {GOVERNORATE_LABELS_AR[ev.governorate]}
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/25 bg-icy p-4">
                  <div className="text-[11px] font-bold text-primary-ink">المتطوعون المقبولون</div>
                  <div className="mt-1 text-xs font-black text-ink">
                    {ev.capacity ? `${ev.acceptedCount} / ${ev.capacity} متطوع` : `${ev.acceptedCount} متطوع`}
                  </div>
                  {ev.capacity ? (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-teal-grad" style={{ width: `${percent}%` }} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-[11px] font-bold text-muted">{timeAgo(post.createdAt)}</p>
            )}

            <div className="space-y-2.5">
              <h2 className="font-display text-base font-black text-ink">التفاصيل</h2>
              <p className="whitespace-pre-line text-sm font-medium leading-8 text-muted">{post.body}</p>
              {ev?.minAge ? (
                <Badge tone="primary">العمر من {ev.minAge} سنة يوم الفعالية</Badge>
              ) : null}
            </div>

            {ev && ev.roles.length > 0 ? (
              <div className="space-y-3">
                <h2 className="font-display text-base font-black text-ink">أدوار المتطوعين</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {ev.roles.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-line bg-canvas p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-ink">{r.name}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            r.seatsLeft > 0
                              ? "bg-environment/10 text-environment-ink"
                              : "bg-humanitarian/10 text-humanitarian-ink"
                          }`}
                        >
                          {r.seatsLeft > 0 ? `باقي ${r.seatsLeft}` : "مكتمل"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-icy">
                        <div
                          className="h-full rounded-full bg-teal-grad"
                          style={{ width: `${Math.round((r.seatsTaken / r.seats) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-[11px] font-bold text-muted">
                        {r.seatsTaken} من {r.seats} مقاعد
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {post.media.length > 1 ? (
              <div className="space-y-3">
                <h2 className="font-display text-base font-black text-ink">الصور</h2>
                <div className="grid grid-cols-3 gap-3">
                  {post.media.slice(1).map((m) => (
                    <div key={m.id} className="h-28 overflow-hidden rounded-2xl bg-icy sm:h-36">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Also kept for an event cancelled after it was documented: its badges still link here. */}
            {ev && (ev.status === "COMPLETED" || ev.documentedAt) ? (
              <div
                id="documentation"
                className="scroll-mt-24 space-y-3 rounded-3xl border border-environment/25 bg-environment/10 p-5"
              >
                <h2 className="font-display text-base font-black text-ink">توثيق الفعالية</h2>
                <p className="whitespace-pre-line text-sm font-medium leading-8 text-muted">{ev.documentation}</p>
                {ev.impactMetrics.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {ev.impactMetrics.map((m) => (
                      <div key={m.label} className="rounded-2xl bg-surface p-3 text-center">
                        <div className="font-display text-2xl font-black text-environment-ink">{m.value}</div>
                        <div className="text-[11px] font-bold text-muted">{m.label}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {ev.documentationMedia.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {ev.documentationMedia.map((m) => (
                      <div key={m.id} className="h-28 overflow-hidden rounded-2xl bg-icy sm:h-36">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="space-y-3 rounded-3xl border border-line bg-canvas p-5">
              <div className="flex items-center gap-3">
                <Avatar name={post.author.name} src={post.author.avatarUrl} verified={Boolean(post.author.verifiedKind)} />
                <div>
                  <Link href={`/users/${post.author.id}`} className="text-sm font-black text-ink hover:text-primary-ink">
                    {post.author.name}
                  </Link>
                  <div className={`text-[11px] font-bold ${look.text}`}>
                    {post.author.verifiedKind === "ORGANIZATION" ? "منظمة موثّقة" : "حساب موثّق"}
                  </div>
                </div>
              </div>
              {post.collaborators.length > 0 ? (
                <p className="text-xs font-semibold text-muted">
                  بالتعاون مع: {post.collaborators.map((c) => c.name).join("، ")}
                </p>
              ) : null}
            </div>

            {post.caseDetails ? (
              <div className="space-y-3.5 rounded-3xl border-2 border-primary/25 bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-ink">للمساعدة مباشرة</span>
                  <Badge tone="success">شفافية تامة</Badge>
                </div>
                <a
                  href={`tel:${post.caseDetails.contactPhone}`}
                  className="flex items-center gap-2 rounded-2xl bg-icy/70 p-3 text-sm font-black text-ink"
                  dir="ltr"
                >
                  <Icon name="phone" className="h-4 w-4 text-primary" />
                  {post.caseDetails.contactPhone}
                </a>
                {post.caseDetails.paymentQrUrl ? (
                  <div className="rounded-2xl border border-line bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.caseDetails.paymentQrUrl} alt="رمز شام كاش" className="mx-auto max-h-56" />
                  </div>
                ) : null}
                {post.caseDetails.paymentNote ? (
                  <p className="text-xs font-semibold leading-6 text-muted">{post.caseDetails.paymentNote}</p>
                ) : null}
                <p className="rounded-2xl bg-icy/70 p-3 text-[11px] font-bold leading-6 text-muted">
                  <strong className="block text-ink">المنصة لا تستلم أي مبلغ</strong>
                  التبرع يتم مباشرة لأصحاب الحالة عبر شام كاش أو التواصل معهم.
                </p>
              </div>
            ) : null}

            {post.opportunity ? (
              <div className="space-y-3 rounded-3xl border-2 border-education/25 bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-ink">فرصة خارجية</span>
                  <Badge tone={post.opportunity.isOpen ? "education" : "neutral"}>
                    {post.opportunity.isOpen ? "التقديم مفتوح" : "انتهى التقديم"}
                  </Badge>
                </div>
                {post.opportunity.deadline ? (
                  <p className="text-xs font-bold text-muted">
                    آخر موعد: {formatDay(post.opportunity.deadline)}
                  </p>
                ) : null}
                {post.opportunity.isOpen ? (
                  <a
                    href={post.opportunity.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="organic flex w-full items-center justify-center gap-2 bg-teal-grad py-3 text-sm font-black text-white shadow-glow"
                  >
                    قدّم على الفرصة
                    <Icon name="link" className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            ) : null}

            {ev && event ? (
              <div
                id="apply"
                className="scroll-mt-28 space-y-3.5 rounded-3xl border-2 border-primary/25 bg-surface p-5"
              >
                <span className="text-xs font-black text-ink">التطوع في هذه الفعالية</span>
                {ev.isOrganizer ? (
                  <Link
                    href={`/posts/${post.id}/manage`}
                    className="organic flex w-full items-center justify-center gap-2 bg-navy-grad py-3 text-sm font-black text-white"
                  >
                    <Icon name="sliders" className="h-4 w-4" />
                    إدارة الفعالية والمتطوعين
                  </Link>
                ) : null}
                {mine && mine.status !== "WITHDRAWN" ? (
                  <div className="space-y-2.5">
                    <div className={`rounded-2xl p-3 text-xs font-black ${APPLICATION_LABEL[mine.status].tone}`}>
                      {APPLICATION_LABEL[mine.status].text}
                      {mine.role ? ` · دورك: ${mine.role.name}` : ""}
                    </div>
                    {mine.roleChoices.length > 0 && mine.status === "PENDING" ? (
                      <p className="text-[11px] font-bold text-muted">
                        اخترت: {mine.roleChoices.map((c) => c.name).join("، ")}
                      </p>
                    ) : null}
                    {(mine.status === "PENDING" || mine.status === "ACCEPTED") &&
                    (ev.status === "OPEN" || ev.status === "CLOSED") ? (
                      <WithdrawForm applicationId={mine.id} eventId={post.id} />
                    ) : null}
                    {mine.status === "ACCEPTED" && ev.status === "COMPLETED" ? (
                      <div className="space-y-3 border-t border-line pt-3">
                        {myBadge && myBadge.status !== "REJECTED" ? (
                          <div className="rounded-2xl bg-icy p-3 text-xs font-black text-primary-ink">
                            {myBadge.status === "APPROVED"
                              ? `${myBadge.kind === "CERTIFICATE" ? "حصلت على شهادة الحضور" : "حصلت على الشارة"} 🏅`
                              : myBadge.kind === "CERTIFICATE"
                                ? "طلب شهادة الحضور بانتظار المنظّم"
                                : "طلب الشارة بانتظار المنظّم"}
                          </div>
                        ) : (
                          <RequestBadgeForm
                            applicationId={mine.id}
                            eventId={post.id}
                            certificate={post.section.slug === "education"}
                          />
                        )}
                        {ratingOpen ? (
                          <RateForm
                            applicationId={mine.id}
                            eventId={post.id}
                            current={mine.rating?.stars ?? null}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {canApply ? (
                  <ApplyForm eventId={post.id} roles={ev.roles} questions={ev.questions} />
                ) : !mine && !ev.isOrganizer && organization ? (
                  <p className="text-xs font-semibold leading-6 text-muted">
                    التطوع في الفعاليات للأفراد. حسابات الجمعيات تنظّم الفعاليات ولا تسجّل فيها.
                  </p>
                ) : !mine && !ev.isOrganizer ? (
                  <p className="text-xs font-semibold text-muted">التسجيل في هذه الفعالية غير متاح الآن.</p>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </article>

      <Card id="comments" className="scroll-mt-28 space-y-5 p-6 sm:p-8">
        <h2 className="font-display text-lg font-black text-ink">التعليقات ({post.commentCount})</h2>
        {frozen ? (
          <p className="rounded-2xl bg-canvas p-3 text-xs font-semibold text-muted">
            التعليق متاح بعد توثيق الجمعية.
          </p>
        ) : (
          <CommentForm postId={post.id} />
        )}
        {comments.length === 0 ? (
          <p className="text-xs font-semibold text-muted">لا توجد تعليقات بعد. كن أول من يكتب.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="space-y-2.5 rounded-2xl border border-line bg-canvas p-4">
                <CommentRow comment={c} canDelete={canDeleteComment(c)} canReport={c.author.id !== me.id && !frozen} postId={post.id} />
                {(c.replies ?? []).map((r) => (
                  <div key={r.id} className="ms-6 rounded-2xl border border-line bg-surface p-3.5">
                    <CommentRow comment={r} canDelete={canDeleteComment(r)} canReport={r.author.id !== me.id && !frozen} postId={post.id} />
                  </div>
                ))}
                {frozen ? null : (
                  <details className="ms-6">
                    <summary className="cursor-pointer text-[11px] font-black text-primary-ink">ردّ</summary>
                    <div className="mt-2">
                      <CommentForm postId={post.id} parentId={c.id} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  canReport,
  postId,
}: {
  comment: CommentView;
  canDelete: boolean;
  canReport: boolean;
  postId: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={comment.author.name} src={comment.author.avatarUrl} verified={Boolean(comment.author.verifiedKind)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          <strong className="font-black text-ink">{comment.author.name}</strong>
          <span className="font-semibold text-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-line text-sm font-medium leading-7 text-ink-soft">{comment.body}</p>
      </div>
      {canReport ? <ReportButton target="COMMENT" targetId={comment.id} label="" /> : null}
      {canDelete ? (
        <form action={deleteCommentAction}>
          <input type="hidden" name="commentId" value={comment.id} />
          <input type="hidden" name="postId" value={postId} />
          <button
            type="submit"
            className="text-[11px] font-bold text-muted hover:text-humanitarian-ink"
            aria-label="حذف التعليق"
          >
            حذف
          </button>
        </form>
      ) : null}
    </div>
  );
}

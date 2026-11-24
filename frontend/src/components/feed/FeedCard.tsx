import Link from "next/link";
import { GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Icon } from "@/components/ui/Icon";
import { toggleUpvoteAction } from "@/lib/actions/posts";
import { formatDay, formatHours, timeAgo } from "@/lib/format";
import { sectionLook } from "@/lib/sections";
import type { PostView } from "@/lib/types";

const EVENT_STATUS: Record<NonNullable<PostView["event"]>["status"], string> = {
  OPEN: "التسجيل مفتوح",
  CLOSED: "التسجيل مغلق",
  COMPLETED: "اكتملت",
  CANCELLED: "أُلغيت",
};

/**
 * The reference feed card (photo on top, section badge, organizer, details, upvote and
 * comments). Works for normal posts, events, humanitarian cases and opportunities.
 */
/**
 * `canVolunteer`: false for organization accounts, which do not apply to events.
 * `readOnly`: an organization waiting for verification can only look (no upvote).
 */
export function FeedCard({
  post,
  back = "/",
  canVolunteer = true,
  readOnly = false,
}: {
  post: PostView;
  back?: string;
  canVolunteer?: boolean;
  readOnly?: boolean;
}) {
  const look = sectionLook(post.section.slug);
  const href = `/posts/${post.id}`;
  const cover = post.media[0]?.url;
  const ev = post.event;
  const percent =
    ev && ev.capacity ? Math.min(100, Math.round((ev.acceptedCount / ev.capacity) * 100)) : 0;

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-card border border-line/80 bg-surface shadow-soft transition duration-300 hover:shadow-soft-hover">
      <div>
        <Link href={href} className="relative block h-48 overflow-hidden bg-icy">
          {cover ? (
            // Uploaded images are served by our API; plain <img> keeps it simple.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <span className={`flex h-full w-full items-center justify-center ${look.solid} opacity-90`}>
              <Icon name={look.icon} className="h-16 w-16 opacity-80" strokeWidth={1.6} />
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-[#13263A]/65 via-transparent to-transparent" />
          <span
            className={`absolute right-3.5 top-3.5 rounded-full px-3 py-1 text-[11px] font-black shadow-sm ${look.solid}`}
          >
            {post.section.nameAr}
          </span>
          {post.caseDetails ? (
            <span className="absolute left-3.5 top-3.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-humanitarian-ink">
              حالة إنسانية
            </span>
          ) : ev ? (
            <span className="absolute left-3.5 top-3.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-primary-dark">
              {EVENT_STATUS[ev.status]}
            </span>
          ) : null}
          <span className="absolute bottom-3 right-3.5 flex items-center gap-1.5 text-[11px] font-extrabold text-white">
            <span className="h-2 w-2 rounded-full bg-primary-light" />
            {post.author.name}
            {post.author.verifiedKind ? " ✓" : ""}
          </span>
        </Link>

        <div className="space-y-3 p-5">
          <div>
            <h3 className="font-display text-base font-black leading-snug text-ink transition group-hover:text-primary-ink">
              <Link href={href}>{post.title}</Link>
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-muted">
              {ev ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="pin" className="h-3.5 w-3.5" />
                    {ev.city}، {GOVERNORATE_LABELS_AR[ev.governorate]}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    {formatDay(ev.startsAt)}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1 font-black text-primary-ink">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    {formatHours(ev.volunteerHours)}
                  </span>
                </>
              ) : (
                <span>{timeAgo(post.createdAt)}</span>
              )}
              {post.opportunity ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span className={post.opportunity.isOpen ? "text-education-ink" : ""}>
                    {post.opportunity.isOpen
                      ? post.opportunity.deadline
                        ? `التقديم حتى ${formatDay(post.opportunity.deadline)}`
                        : "التقديم مفتوح"
                      : "انتهى التقديم"}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {ev && ev.capacity ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-muted">تقدّم المتطوعين</span>
                <span className="font-black text-ink">
                  {ev.acceptedCount} / {ev.capacity} متطوع
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-icy">
                <div className="h-full rounded-full bg-teal-grad" style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : (
            <p className="line-clamp-2 text-xs font-semibold leading-6 text-muted">{post.body}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-line/60 px-5 pb-5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <form action={toggleUpvoteAction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="upvoted" value={String(post.upvotedByMe)} />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                aria-pressed={post.upvotedByMe}
                disabled={readOnly}
                title={readOnly ? "متاح بعد توثيق الجمعية" : undefined}
                className={`organic organic-sm flex items-center gap-1 px-3 py-1.5 text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-60 ${
                  post.upvotedByMe
                    ? "border border-primary/40 bg-icy text-primary-ink"
                    : "border border-transparent bg-canvas text-muted"
                }`}
              >
                <Icon name="up" className="h-3.5 w-3.5" strokeWidth={2.6} />
                رفع ({post.upvoteCount})
              </button>
            </form>
            <Link
              href={`${href}#comments`}
              className="organic organic-sm flex items-center gap-1 bg-canvas px-3 py-1.5 text-[11px] font-bold text-muted hover:text-ink"
            >
              <Icon name="comment" className="h-3.5 w-3.5" />
              {post.commentCount}
            </Link>
          </div>
          {post.caseDetails?.paymentQrUrl ? (
            <Link
              href={href}
              className="organic organic-sm border border-primary/20 bg-icy px-2.5 py-1.5 text-[10px] font-extrabold text-primary-ink"
            >
              شام كاش QR
            </Link>
          ) : null}
        </div>

        <div className={`grid gap-2 ${ev?.status === "OPEN" && canVolunteer ? "grid-cols-2" : "grid-cols-1"}`}>
          {ev?.status === "OPEN" && canVolunteer ? (
            <Link
              href={`${href}#apply`}
              className="organic organic-sm flex items-center justify-center bg-teal-grad py-2.5 text-xs font-black text-white shadow-glow"
            >
              تطوع الآن
            </Link>
          ) : null}
          <Link
            href={href}
            className="organic organic-sm flex items-center justify-center border border-primary/25 bg-icy py-2.5 text-xs font-black text-primary-ink hover:bg-navy-grad hover:text-white"
          >
            التفاصيل
          </Link>
        </div>
      </div>
    </article>
  );
}

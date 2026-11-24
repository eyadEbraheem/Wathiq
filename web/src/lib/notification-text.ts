import { newVolunteersWord } from "@/components/highlights/WeeklyHighlightCard";
import type { IconName } from "@/components/ui/Icon";

export interface NotificationView {
  id: number;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actor: { id: number; name: string; verifiedKind: string | null } | null;
  post: { id: number; kind: "POST" | "EVENT"; title: string; sectionId: number } | null;
}

/** The sentence and icon of each notification type in the inbox (Arabic only for now). */
export function notificationText(n: NotificationView): { text: string; icon: IconName } {
  const who = n.actor?.name ?? "أحدهم";
  const title = n.post ? `«${n.post.title}»` : "";
  const status = typeof n.data.status === "string" ? n.data.status : "";
  const role = typeof n.data.roleName === "string" ? n.data.roleName : "";
  switch (n.type) {
    case "FOLLOWED_ACCOUNT_POSTED":
      return { text: `${who} نشر جديداً: ${title}`, icon: "users" };
    case "SECTION_NEW_POST":
    case "TOPIC_NEW_POST":
      return { text: `جديد في اهتماماتك: ${title}`, icon: "grid" };
    case "COMMENT_ON_POST":
      return { text: `${who} علّق على ${title}`, icon: "comment" };
    case "COMMENT_REPLY":
      return { text: `${who} ردّ على تعليقك في ${title}`, icon: "comment" };
    case "EVENT_APPLICATION_RECEIVED":
      return { text: `${who} قدّم على فعاليتك ${title}`, icon: "calendar" };
    case "EVENT_APPLICATION_DECIDED":
      return status === "ACCEPTED"
        ? { text: `تم قبولك في ${title}${role ? ` بدور ${role}` : ""}`, icon: "check" }
        : { text: `لم يُقبل طلبك في ${title} هذه المرة`, icon: "calendar" };
    case "EVENT_APPLICATION_WITHDRAWN":
      return { text: `${who} انسحب من ${title}`, icon: "calendar" };
    case "EVENT_ROLE_CHANGED":
      return { text: `تغيّر دورك في ${title}${role ? ` إلى ${role}` : ""}`, icon: "calendar" };
    case "EVENT_CANCELLED":
      return { text: `أُلغيت الفعالية ${title}`, icon: "calendar" };
    case "EVENT_DOCUMENTED":
      return { text: `وُثّقت ${title}، يمكنك الآن طلب شارتك`, icon: "check" };
    case "EVENT_DOCUMENTATION_OVERDUE":
      return { text: `فعالية لم توثَّق في موعدها: ${title}`, icon: "shield" };
    case "BADGE_REQUESTED":
      return { text: `${who} يطلب شارة من ${title}`, icon: "shield" };
    case "BADGE_DECIDED":
      return status === "APPROVED"
        ? { text: `حصلت على شارة ${title}`, icon: "shield" }
        : { text: `تحديث على طلب شارتك من ${title}`, icon: "shield" };
    case "COLLAB_INVITED":
      return { text: `${who} يدعوك للتعاون على ${title}`, icon: "users" };
    case "COLLAB_ACCEPTED":
      return { text: `${who} قبل التعاون على ${title}`, icon: "users" };
    case "PUBLISH_REQUEST_RECEIVED":
      return { text: `${who} أرسل طلب نشر`, icon: "plus" };
    case "PUBLISH_REQUEST_DECIDED":
      return status === "APPROVED"
        ? { text: `نُشر طلبك ${title}`, icon: "check" }
        : { text: "تحديث على طلب النشر الذي أرسلته", icon: "plus" };
    case "VERIFICATION_DECIDED":
      return status === "APPROVED"
        ? { text: "تم توثيق حسابك، صار بإمكانك النشر وتنظيم الفعاليات", icon: "shield" }
        : { text: "تحديث على طلب التوثيق", icon: "shield" };
    case "TEAM_MEMBERSHIP_REQUESTED":
      return { text: `${who} يطلب الانضمام لفريقك`, icon: "users" };
    case "TEAM_MEMBERSHIP_DECIDED":
      return { text: `تحديث على عضويتك في ${who}`, icon: "users" };
    case "WEEKLY_HIGHLIGHT": {
      const count = typeof n.data.newVolunteers === "number" ? n.data.newVolunteers : 0;
      return n.data.winner === true
        ? { text: `أنتم جمعية الأسبوع ⭐ استقبلتم ${count} ${newVolunteersWord(count)}. شكراً لأنكم تفتحون الباب للجميع`, icon: "star" }
        : { text: `${who} هي جمعية الأسبوع ⭐ استقبلت ${count} ${newVolunteersWord(count)}`, icon: "star" };
    }
    case "CONTENT_MODERATED":
      return n.data.suspended === true
        ? { text: "تم إيقاف حسابك مؤقتاً من الإدارة", icon: "shield" }
        : { text: "أخفت الإدارة محتوى لك بعد مراجعة بلاغ", icon: "shield" };
    default:
      return { text: "إشعار جديد", icon: "bell" };
  }
}

/**
 * The page a notification opens: where the user can act on it (review applicants, decide a
 * badge, answer a request), not just the post it is about.
 */
export function notificationTarget(n: NotificationView, viewer?: { role: string }): string {
  const postId = n.post?.id;
  const status = typeof n.data.status === "string" ? n.data.status : "";
  switch (n.type) {
    case "EVENT_APPLICATION_RECEIVED":
      return postId ? `/posts/${postId}/manage?tab=volunteers&status=PENDING` : "/applications";
    case "EVENT_APPLICATION_WITHDRAWN":
      return postId ? `/posts/${postId}/manage?tab=volunteers&status=WITHDRAWN` : "/applications";
    case "BADGE_REQUESTED":
      return postId ? `/posts/${postId}/manage?tab=badges` : "/applications";
    case "BADGE_DECIDED":
      return "/badges";
    case "PUBLISH_REQUEST_RECEIVED": {
      // A request to the platform is decided by admins on the admin page. Older notifications
      // do not say where the request went, so fall back to the viewer's role.
      const toPlatform =
        typeof n.data.toPlatform === "boolean" ? n.data.toPlatform : viewer?.role === "ADMIN";
      return toPlatform ? "/admin?tab=requests" : "/requests";
    }
    case "PUBLISH_REQUEST_DECIDED":
      return status === "APPROVED" && postId ? `/posts/${postId}` : "/requests";
    case "VERIFICATION_DECIDED":
      return "/verify";
    case "TEAM_MEMBERSHIP_REQUESTED":
      // The team decides on its members page.
      return "/members?status=PENDING";
    case "TEAM_MEMBERSHIP_DECIDED":
      return n.actor ? `/users/${n.actor.id}` : "/notifications";
    case "CONTENT_MODERATED":
      return postId ? `/posts/${postId}` : "/me";
    case "WEEKLY_HIGHLIGHT":
      return n.data.winner === true || !n.actor ? "/highlights" : `/users/${n.actor.id}`;
    default:
      return postId ? `/posts/${postId}` : "/notifications";
  }
}

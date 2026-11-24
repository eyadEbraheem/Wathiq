import { NotificationType, type Prisma } from '@prisma/client';

/** What a push message needs from a notification row. */
export interface PushSource {
  type: NotificationType;
  data: Prisma.JsonValue;
  actorName: string | null;
  postTitle: string | null;
}

type Text = { title: string; body: string };

function field(data: Prisma.JsonValue, key: string): unknown {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)[key]
    : undefined;
}

/**
 * The Arabic title and body of each notification type (the app is Arabic only for now). The
 * full details stay in the in-app inbox; the push only points to it.
 */
const TEXTS: Record<NotificationType, (s: PushSource) => Text> = {
  FOLLOWED_ACCOUNT_POSTED: (s) => ({
    title: `${s.actorName ?? 'حساب تتابعه'} نشر جديداً`,
    body: s.postTitle ?? '',
  }),
  SECTION_NEW_POST: (s) => ({
    title: 'منشور جديد في قسم يهمّك',
    body: s.postTitle ?? '',
  }),
  TOPIC_NEW_POST: (s) => ({
    title: 'منشور جديد في موضوع يهمّك',
    body: s.postTitle ?? '',
  }),
  COLLAB_INVITED: (s) => ({
    title: 'دعوة للتعاون',
    body: `${s.actorName ?? ''} يدعوك للتعاون على: ${s.postTitle ?? ''}`,
  }),
  COLLAB_ACCEPTED: (s) => ({
    title: 'تم قبول دعوة التعاون',
    body: `${s.actorName ?? ''} صار متعاوناً على: ${s.postTitle ?? ''}`,
  }),
  EVENT_APPLICATION_RECEIVED: (s) => ({
    title: 'طلب تطوع جديد',
    body: `${s.actorName ?? ''} قدّم على: ${s.postTitle ?? ''}`,
  }),
  EVENT_APPLICATION_DECIDED: (s) => {
    const accepted = field(s.data, 'status') === 'ACCEPTED';
    const role = field(s.data, 'roleName');
    return accepted
      ? {
          title: 'تم قبولك 🎉',
          body: `${s.postTitle ?? ''}${typeof role === 'string' && role ? ` — دورك: ${role}` : ''}`,
        }
      : { title: 'تحديث على طلب التطوع', body: s.postTitle ?? '' };
  },
  EVENT_APPLICATION_WITHDRAWN: (s) => ({
    title: 'انسحاب متطوع',
    body: `${s.actorName ?? ''} انسحب من: ${s.postTitle ?? ''}`,
  }),
  WEEKLY_HIGHLIGHT: (s) => {
    const n = Number(field(s.data, 'newVolunteers') ?? 0);
    // Arabic counted noun: 3 to 10 take the plural, the rest the singular.
    const word = n % 100 >= 3 && n % 100 <= 10 ? 'متطوعين جدد' : 'متطوعاً جديداً';
    return field(s.data, 'winner') === true
      ? {
          title: 'أنتم جمعية الأسبوع ⭐',
          body: `استقبلتم ${n} ${word} هذا الأسبوع. شكراً لأنكم تفتحون الباب للجميع.`,
        }
      : {
          title: 'جمعية الأسبوع ⭐',
          body: `${s.actorName ?? ''} استقبلت أكبر عدد من المتطوعين الجدد هذا الأسبوع.`,
        };
  },
  EVENT_ROLE_CHANGED: (s) => {
    const role = field(s.data, 'roleName');
    return {
      title: 'تغيّر دورك في الفعالية',
      body: `${s.postTitle ?? ''}${typeof role === 'string' ? ` — دورك الجديد: ${role}` : ''}`,
    };
  },
  EVENT_CANCELLED: (s) => ({
    title: 'أُلغيت الفعالية',
    body: s.postTitle ?? '',
  }),
  EVENT_DOCUMENTED: (s) => ({
    title: 'تم توثيق الفعالية',
    body: `يمكنك الآن طلب شارتك من: ${s.postTitle ?? ''}`,
  }),
  EVENT_DOCUMENTATION_OVERDUE: (s) => ({
    title: 'فعالية لم توثَّق في موعدها',
    body: s.postTitle ?? '',
  }),
  BADGE_REQUESTED: (s) => ({
    title: 'طلب شارة',
    body: `${s.actorName ?? ''} يطلب شارة: ${s.postTitle ?? ''}`,
  }),
  BADGE_DECIDED: (s) =>
    field(s.data, 'status') === 'APPROVED'
      ? { title: 'حصلت على شارة جديدة 🏅', body: s.postTitle ?? '' }
      : { title: 'تحديث على طلب الشارة', body: s.postTitle ?? '' },
  COMMENT_ON_POST: (s) => ({
    title: 'تعليق جديد',
    body: `${s.actorName ?? ''} علّق على: ${s.postTitle ?? ''}`,
  }),
  COMMENT_REPLY: (s) => ({
    title: 'ردّ جديد',
    body: `${s.actorName ?? ''} ردّ على تعليقك`,
  }),
  PUBLISH_REQUEST_RECEIVED: (s) => ({
    title: 'طلب نشر جديد',
    body: `${s.actorName ?? ''} يطلب نشر منشور`,
  }),
  PUBLISH_REQUEST_DECIDED: (s) =>
    field(s.data, 'status') === 'APPROVED'
      ? { title: 'تم نشر طلبك', body: s.postTitle ?? '' }
      : { title: 'تحديث على طلب النشر', body: 'افتح التطبيق لمعرفة التفاصيل' },
  VERIFICATION_DECIDED: (s) =>
    field(s.data, 'status') === 'APPROVED'
      ? {
          title: 'تم توثيق حسابك ✔',
          body: 'صار بإمكانك النشر وتنظيم الفعاليات',
        }
      : {
          title: 'تحديث على طلب التوثيق',
          body: 'افتح التطبيق لمعرفة التفاصيل',
        },
  TEAM_MEMBERSHIP_REQUESTED: (s) => ({
    title: 'طلب انضمام للفريق',
    body: `${s.actorName ?? ''} يطلب الانضمام`,
  }),
  TEAM_MEMBERSHIP_DECIDED: (s) =>
    field(s.data, 'status') === 'APPROVED'
      ? { title: 'تمت الموافقة على عضويتك', body: s.actorName ?? '' }
      : { title: 'تحديث على عضويتك', body: s.actorName ?? '' },
  CONTENT_MODERATED: (s) =>
    field(s.data, 'suspended') === true
      ? { title: 'إشعار من الإدارة', body: 'تم إيقاف حسابك مؤقتاً' }
      : {
          title: 'إشعار من الإدارة',
          body: 'تم إخفاء محتوى لك بعد مراجعة بلاغ',
        },
};

export function pushText(source: PushSource): Text {
  return TEXTS[source.type](source);
}

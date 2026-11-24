import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from './api';
import { Button, Card, Chip, Row, Title, Txt } from './ui';
import { List, dateText, statusText, useApp } from './state';

interface Notice {
  id: number;
  type: string;
  readAt: string | null;
  createdAt: string;
  actor: { id?: number; name: string } | null;
  post: { id: number; kind: string; title: string } | null;
  data: Record<string, unknown>;
}
const messages: Record<string, string> = {
  FOLLOWED_ACCOUNT_POSTED: 'نشر جديداً',
  SECTION_NEW_POST: 'جديد في مجالك',
  TOPIC_NEW_POST: 'جديد في اهتماماتك',
  COLLAB_INVITED: 'دعوة للتعاون',
  COLLAB_ACCEPTED: 'قبول دعوة التعاون',
  EVENT_APPLICATION_RECEIVED: 'طلب مشاركة جديد',
  EVENT_APPLICATION_DECIDED: 'تحديث على طلب مشاركتك',
  EVENT_DOCUMENTED: 'وُثّقت الفعالية، يمكنك طلب شارتك',
  EVENT_DOCUMENTATION_OVERDUE: 'تأخر توثيق الفعالية',
  BADGE_REQUESTED: 'طلب شارة مشاركة',
  BADGE_DECIDED: 'تحديث على طلب الشارة',
  COMMENT_ON_POST: 'تعليق جديد',
  COMMENT_REPLY: 'رد على تعليقك',
  PUBLISH_REQUEST_RECEIVED: 'طلب نشر جديد',
  PUBLISH_REQUEST_DECIDED: 'تحديث على طلب النشر',
  VERIFICATION_DECIDED: 'تحديث على توثيق حسابك',
  TEAM_MEMBERSHIP_REQUESTED: 'طلب عضوية جديد',
  TEAM_MEMBERSHIP_DECIDED: 'تحديث على عضويتك',
  CONTENT_MODERATED: 'إشعار من الإدارة',
  EVENT_ROLE_CHANGED: 'تغير دورك في الفعالية',
  EVENT_CANCELLED: 'أُلغيت الفعالية',
  EVENT_APPLICATION_WITHDRAWN: 'انسحاب متطوع',
  WEEKLY_HIGHLIGHT: 'جمعية الأسبوع ⭐',
};

/** The line of a notification; the organization of the week reads differently for the winner. */
function messageOf(n: Notice): string {
  if (n.type === 'WEEKLY_HIGHLIGHT' && n.data.winner === true) {
    const count =
      typeof n.data.newVolunteers === 'number' ? n.data.newVolunteers : 0;
    return `أنتم جمعية الأسبوع ⭐ استقبلتم ${count} من المتطوعين الجدد`;
  }
  return messages[n.type] ?? 'إشعار جديد';
}
export function Inbox() {
  const { go, me, refreshNotifications } = useApp();
  const [unread, setUnread] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <View style={{ gap: 16 }}>
      <Title>إشعاراتك</Title>
      <Row>
        <Chip title="الكل" active={!unread} onPress={() => setUnread(false)} />
        <Chip
          title="غير المقروءة"
          active={unread}
          onPress={() => setUnread(true)}
        />
      </Row>
      <Button
        subtle
        title="تحديد الكل كمقروء"
        onPress={async () => {
          await api('/notifications/read-all', 'POST');
          refreshNotifications();
          setRevision((n) => n + 1);
        }}
      />
      <List<Notice>
        revision={revision}
        path={`/notifications?unreadOnly=${unread}`}
        render={(n, reload) => (
          <Card>
            <Txt style={{ fontFamily: !n.readAt ? 'TajawalBold' : 'Tajawal' }}>
              {!n.readAt ? '● ' : ''}
              {messageOf(n)}
            </Txt>
            {n.actor && <Txt>{n.actor.name}</Txt>}
            {n.post && <Txt>{n.post.title}</Txt>}
            {typeof n.data.status === 'string' && (
              <Txt>{statusText[n.data.status] ?? ''}</Txt>
            )}
            {typeof n.data.roleName === 'string' && (
              <Txt>{n.data.roleName}</Txt>
            )}
            {n.data.suspended === true && <Txt>تم إيقاف حسابك مؤقتاً.</Txt>}
            <Txt style={{ fontSize: 12 }}>{dateText(n.createdAt)}</Txt>
            <Button
              subtle
              title="فتح"
              onPress={async () => {
                await api(`/notifications/${n.id}/read`, 'PATCH');
                refreshNotifications();
                reload();
                go(notificationRoute(n, me.role));
              }}
            />
          </Card>
        )}
      />
    </View>
  );
}

export function notificationRoute(
  n: Pick<Notice, 'type' | 'data' | 'post'> & { actor?: Notice['actor'] },
  role: string,
) {
  const id = n.post?.id;
  switch (n.type) {
    case 'PUBLISH_REQUEST_RECEIVED':
      return (
        typeof n.data.toPlatform === 'boolean'
          ? n.data.toPlatform
          : role === 'ADMIN'
      )
        ? { name: 'admin', kind: 'requests' }
        : { name: 'requests' };
    case 'PUBLISH_REQUEST_DECIDED':
      return n.data.status === 'APPROVED' && id
        ? { name: 'post', id }
        : { name: 'requests' };
    case 'BADGE_DECIDED':
      return { name: 'badges' };
    case 'EVENT_APPLICATION_RECEIVED':
    case 'EVENT_APPLICATION_WITHDRAWN':
    case 'BADGE_REQUESTED':
      return id ? { name: 'manage', id } : { name: 'applications' };
    case 'VERIFICATION_DECIDED':
      return { name: 'verify' };
    case 'TEAM_MEMBERSHIP_REQUESTED':
      return { name: 'teams', kind: 'incoming' };
    case 'TEAM_MEMBERSHIP_DECIDED':
      return { name: 'teams' };
    case 'COLLAB_INVITED':
      return { name: 'collaborations', id };
    case 'WEEKLY_HIGHLIGHT':
      // The winner opens the honour board; followers open the winner's page.
      return n.data.winner !== true && n.actor?.id
        ? { name: 'user', id: n.actor.id }
        : { name: 'highlights' };
    default:
      return id ? { name: 'post', id, kind: n.post?.kind } : { name: 'me' };
  }
}

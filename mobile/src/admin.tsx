import React, { useState } from 'react';
import { View } from 'react-native';
import type { UserCard } from '@csh/shared';
import { api } from './api';
import { Button, Card, Chip, Confirm, Row, Title, Txt } from './ui';
import { Form, field } from './forms';
import { select } from './catalog';
import { List, useApp } from './state';
import { Person } from './feed';
import { Requests, type Verification } from './workflows';

interface ReportItem {
  id: number;
  target: string;
  reason: string;
  details: string;
  reporter: UserCard;
  post: { id: number; title: string; status: string; author: UserCard } | null;
  comment: {
    id: number;
    body: string;
    status: string;
    postId: number;
    author: UserCard;
  } | null;
  reportedUser: (UserCard & { isSuspended: boolean }) | null;
}
export function Admin({ initialTab = 'verification' }: { initialTab?: string }) {
  const { me, go } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState('OPEN');
  if (me.role !== 'ADMIN') return <Txt>هذه الصفحة متاحة للإدارة فقط.</Txt>;
  return (
    <View style={{ gap: 16 }}>
      <Title>إدارة واثق</Title>
      <Row>
        {[
          ['verification', 'التوثيق'],
          ['reports', 'البلاغات'],
          ['requests', 'طلبات النشر'],
          ['users', 'الحسابات والمحتوى'],
          ['words', 'الكلمات الممنوعة'],
        ].map(([value, label]) => (
          <Chip
            key={value}
            title={label}
            active={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </Row>
      {tab === 'verification' && (
        <List<Verification>
          path="/verification-requests?status=PENDING"
          render={(v) => (
            <Card>
              {v.user && <Person person={v.user} />}
              <Txt>{v.details}</Txt>
              <Button
                title="مراجعة الوثائق"
                onPress={() => go({ name: 'verification-review', id: v.id })}
              />
            </Card>
          )}
        />
      )}
      {tab === 'requests' && <Requests platform />}
      {tab === 'reports' && (
        <>
          <Row>
            {[
              ['OPEN', 'مفتوحة'],
              ['RESOLVED', 'عولجت'],
              ['DISMISSED', 'تُجاهلت'],
            ].map(([value, label]) => (
              <Chip
                key={value}
                title={label}
                active={status === value}
                onPress={() => setStatus(value)}
              />
            ))}
          </Row>
          <List<ReportItem>
            path={`/admin/reports?status=${status}`}
            render={(r, reload) => (
              <Card>
                <Person person={r.reporter} />
                <Txt>
                  {
                    (
                      {
                        FRAUD: 'احتيال',
                        OFFENSIVE: 'إساءة',
                        SPAM: 'إزعاج',
                        MISLEADING: 'تضليل',
                        OTHER: 'سبب آخر',
                      } as Record<string, string>
                    )[r.reason]
                  }
                </Txt>
                <Txt>{r.details}</Txt>
                {r.post && (
                  <>
                    <Title>{r.post.title}</Title>
                    <Button
                      subtle
                      title="عرض المنشور"
                      onPress={() => go({ name: 'post', id: r.post!.id })}
                    />
                  </>
                )}
                {r.comment && (
                  <>
                    <Txt>{r.comment.body}</Txt>
                    <Button
                      subtle
                      title="عرض النقاش"
                      onPress={() =>
                        go({ name: 'post', id: r.comment!.postId })
                      }
                    />
                  </>
                )}
                {r.reportedUser && <Person person={r.reportedUser} />}
                {status === 'OPEN' && (
                  <>
                    <Form
                      fields={[
                        ...(r.target !== 'USER'
                          ? [field('hideContent', 'إخفاء المحتوى', 'boolean')]
                          : []),
                        field('suspendUser', 'إيقاف الحساب', 'boolean'),
                      ]}
                      title="معالجة البلاغ"
                      submit={(v) =>
                        api(`/admin/reports/${r.id}/resolve`, 'POST', v)
                      }
                      after={reload}
                    />
                    <Confirm
                      title="تجاهل البلاغ"
                      action={async () => {
                        await api(`/admin/reports/${r.id}/dismiss`, 'POST');
                        reload();
                      }}
                    />
                  </>
                )}
              </Card>
            )}
          />
        </>
      )}
      {tab === 'users' && (
        <Card>
          <Title>إدارة حساب أو محتوى</Title>
          <Form
            fields={[
              select(
                'target',
                'النوع',
                [
                  { value: 'users', label: 'حساب' },
                  { value: 'posts', label: 'منشور' },
                  { value: 'comments', label: 'تعليق' },
                ],
                true,
              ),
              field('id', 'رقم الحساب أو المحتوى', 'number', true),
              field('restore', 'رفع الإيقاف / استعادة المحتوى', 'boolean'),
            ]}
            initial={{ target: 'users' }}
            title="متابعة"
            submit={async (v) => {
              await new Promise<void>((resolve, reject) => {
                const action =
                  v.target === 'users'
                    ? v.restore
                      ? 'unsuspend'
                      : 'suspend'
                    : v.restore
                      ? 'restore'
                      : 'hide';
                import('react-native').then(({ Alert }) =>
                  Alert.alert(
                    'تأكيد إجراء الإدارة',
                    `تطبيق الإجراء على الرقم ${v.id}؟`,
                    [
                      {
                        text: 'تراجع',
                        onPress: () =>
                          reject(new Error('لم يتم تنفيذ الإجراء.')),
                      },
                      {
                        text: 'تأكيد',
                        style: 'destructive',
                        onPress: () => {
                          api(`/admin/${v.target}/${v.id}/${action}`, 'POST')
                            .then(() => resolve())
                            .catch(reject);
                        },
                      },
                    ],
                    { cancelable: false },
                  ),
                );
              });
            }}
          />
        </Card>
      )}
      {tab === 'words' && (
        <>
          <Card>
            <Form
              fields={[field('word', 'كلمة أو عبارة ممنوعة', 'text', true)]}
              title="إضافة"
              submit={(v) => api('/admin/banned-words', 'POST', v)}
              after={() => setRevision((n) => n + 1)}
            />
          </Card>
          <List<{ id: number; word: string }>
            revision={revision}
            path="/admin/banned-words"
            render={(w, reload) => (
              <Card>
                <Txt>{w.word}</Txt>
                <Confirm
                  title="حذف الكلمة"
                  action={async () => {
                    await api(`/admin/banned-words/${w.id}`, 'DELETE');
                    reload();
                  }}
                />
              </Card>
            )}
          />
        </>
      )}
    </View>
  );
}

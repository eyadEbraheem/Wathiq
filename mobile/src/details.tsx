import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import type {
  BadgeView,
  CommentView,
  EventPage,
  OrganizerApplication,
  PostView,
} from '@csh/shared';
import { api } from './api';
import { Button, Card, Chip, Confirm, Photo, Row, Title, Txt } from './ui';
import { Form, field, type Field } from './forms';
import { dateFields, select } from './catalog';
import { List, Resource, dateText, query, statusText, useApp } from './state';
import { Person } from './feed';
import { isOrganization } from './accounts';

export async function openLink(url: string) {
  if (!/^https?:\/\//i.test(url))
    throw new Error('الرابط يجب أن يبدأ بـ https:// أو http://');
  await Linking.openURL(url);
}
export function Detail({ id, kind }: { id: number; kind?: string }) {
  return (
    <Resource<PostView> path={`/posts/${id}`}>
      {(post, reload) =>
        post.kind === 'EVENT' ? (
          <Resource<EventPage> path={`/events/${id}`}>
            {(event, reloadEvent) => (
              <Content
                post={event}
                reload={() => {
                  reloadEvent();
                  reload();
                }}
              />
            )}
          </Resource>
        ) : (
          <Content post={post} reload={reload} />
        )
      }
    </Resource>
  );
}
function Content({
  post,
  reload,
}: {
  post: PostView | EventPage;
  reload: () => void;
}) {
  const { me, go, back } = useApp();
  const event = post.kind === 'EVENT' ? (post as EventPage) : undefined;
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Person person={post.author} />
        <Txt>
          {post.section.nameAr} · {dateText(post.createdAt)}
        </Txt>
        <Title>{post.title}</Title>
        {post.media.map((m) => (
          <Photo key={m.id} uri={m.url} />
        ))}
        <Txt>{post.body}</Txt>
        {!!post.creditedUser && (
          <>
            <Txt>بطلب من</Txt>
            <Person person={post.creditedUser} />
          </>
        )}
        {post.collaborators.map((p) => (
          <Person key={p.id} person={p} />
        ))}
        <Row>
          {post.topics.map((t) => (
            <Txt key={t.id}>#{t.nameAr}</Txt>
          ))}
        </Row>
        {post.caseDetails && (
          <Card>
            <Title>تفاصيل الحالة</Title>
            <Txt>{post.caseDetails.paymentNote}</Txt>
            <Button
              subtle
              title={`اتصال ${post.caseDetails.contactPhone}`}
              onPress={() =>
                Linking.openURL(
                  `tel:${post.caseDetails!.contactPhone.replace(/[^+\d]/g, '')}`,
                )
              }
            />
            {!!post.caseDetails.paymentQrUrl && (
              <Photo uri={post.caseDetails.paymentQrUrl} />
            )}
          </Card>
        )}
        {post.opportunity && (
          <Card>
            <Title>تفاصيل الفرصة</Title>
            <Txt>
              {
                { ONLINE: 'عن بعد', IN_PERSON: 'حضوري', HYBRID: 'هجين' }[
                  post.opportunity.mode
                ]
              }{' '}
              · {post.opportunity.location}
            </Txt>
            <Txt>{post.opportunity.eligibility}</Txt>
            <Txt>آخر موعد: {dateText(post.opportunity.deadline)}</Txt>
            <Txt>
              {post.opportunity.minAge
                ? `من ${post.opportunity.minAge} سنة `
                : ''}
              {post.opportunity.maxAge
                ? `إلى ${post.opportunity.maxAge} سنة`
                : ''}{' '}
              {post.opportunity.field}
            </Txt>
            <Button
              title={
                post.opportunity.isOpen ? 'التقديم عبر الموقع' : 'انتهى التقديم'
              }
              disabled={!post.opportunity.isOpen}
              onPress={() => openLink(post.opportunity!.applyUrl)}
            />
          </Card>
        )}
        {/* A frozen organization only browses: the API refuses these with 403. */}
        {!me.pendingOrganization && (
          <Row>
            <Button
              subtle
              title={`${post.upvotedByMe ? '♥' : '♡'} ${post.upvoteCount}`}
              onPress={async () => {
                await api(
                  `/posts/${post.id}/upvote`,
                  post.upvotedByMe ? 'DELETE' : 'POST',
                );
                reload();
              }}
            />
            <Button
              subtle
              title="إبلاغ"
              onPress={() => go({ name: 'report', id: post.id, kind: 'POST' })}
            />
          </Row>
        )}
        {post.author.id === me.id && (
          <>
            <Row>
              <Button
                subtle
                title="تعديل"
                onPress={() =>
                  go({ name: 'compose', id: post.id, kind: post.kind })
                }
              />
              <Button
                subtle
                title="المتعاونون"
                onPress={() => go({ name: 'collaborations', id: post.id })}
              />
            </Row>
            {!event && (
              <Confirm
                title="حذف المنشور"
                action={async () => {
                  await api(`/posts/${post.id}`, 'DELETE');
                  back();
                }}
              />
            )}
          </>
        )}
      </Card>
      {event && <EventInfo post={event} reload={reload} />}
      <Title>مساحة الحوار</Title>
      {!me.pendingOrganization && (
        <Form
          key={`comment-${post.id}`}
          fields={[field('body', 'اكتب تعليقك', 'multiline', true)]}
          title="إرسال التعليق"
          submit={(v) => api(`/posts/${post.id}/comments`, 'POST', v)}
          after={reload}
        />
      )}
      <List<CommentView>
        path={`/posts/${post.id}/comments`}
        render={(comment, refresh) => (
          <Comment comment={comment} refresh={refresh} />
        )}
      />
    </View>
  );
}
function Comment({
  comment,
  refresh,
}: {
  comment: CommentView;
  refresh: () => void;
}) {
  const { me, go } = useApp();
  const [reply, setReply] = useState(false);
  return (
    <Card>
      <Person person={comment.author} />
      <Txt>{comment.body}</Txt>
      <Txt style={{ fontSize: 12 }}>{dateText(comment.createdAt)}</Txt>
      <Row>
        {!comment.parentId && !me.pendingOrganization && (
          <Button subtle title="رد" onPress={() => setReply(!reply)} />
        )}
        {!me.pendingOrganization && (
          <Button
            subtle
            title="إبلاغ"
            onPress={() =>
              go({ name: 'report', id: comment.id, kind: 'COMMENT' })
            }
          />
        )}
        {me.id === comment.author.id && (
          <Confirm
            title="حذف التعليق"
            action={async () => {
              await api(`/comments/${comment.id}`, 'DELETE');
              refresh();
            }}
          />
        )}
      </Row>
      {reply && (
        <Form
          fields={[field('body', 'ردّك', 'multiline', true)]}
          title="إرسال الرد"
          submit={(v) =>
            api(`/posts/${comment.postId}/comments`, 'POST', {
              ...v,
              parentId: comment.id,
            })
          }
          after={() => {
            setReply(false);
            refresh();
          }}
        />
      )}
      {comment.replies?.map((r) => (
        <Comment key={r.id} comment={r} refresh={refresh} />
      ))}
    </Card>
  );
}
function EventInfo({ post, reload }: { post: EventPage; reload: () => void }) {
  const { go, me } = useApp();
  const organization = isOrganization(me);
  const e = post.event,
    a = post.myApplication;
  const roles = e.roles.map((r) => ({
    value: r.id,
    label: `${r.name} · ${r.seatsLeft} متاح`,
  }));
  return (
    <Card>
      <Title>تفاصيل الفعالية</Title>
      <Txt>
        {statusText[e.status]} · {e.city} · {e.locationText}
      </Txt>
      <Txt>البداية: {dateText(e.startsAt)}</Txt>
      {e.endsAt && <Txt>النهاية: {dateText(e.endsAt)}</Txt>}
      <Txt>
        آخر موعد للتقديم: {dateText(e.applicationDeadline ?? e.startsAt)}
      </Txt>
      <Txt>
        {e.acceptedCount} متطوع مقبول ·{' '}
        {e.seatsLeft === null ? 'مقاعد غير محدودة' : `${e.seatsLeft} مقعد متاح`}
      </Txt>
      {e.minAge && <Txt>الحد الأدنى للعمر {e.minAge}</Txt>}
      {e.latitude !== null && e.longitude !== null && (
        <Button
          subtle
          title="فتح الموقع على الخريطة"
          onPress={() =>
            openLink(
              `https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}`,
            )
          }
        />
      )}
      {e.isOrganizer ? (
        <Button
          title="إدارة الفعالية"
          onPress={() => go({ name: 'manage', id: post.id })}
        />
      ) : organization ? (
        <Txt>
          التطوع في الفعاليات للأفراد. حسابات الجمعيات تنظّم الفعاليات ولا تسجّل
          فيها.
        </Txt>
      ) : (
        <>
          {a && (
            <>
              <Txt>
                حالة طلبك: {statusText[a.status]}{' '}
                {a.role ? `· ${a.role.name}` : ''}
              </Txt>
              {['PENDING', 'ACCEPTED'].includes(a.status) && (
                <Confirm
                  title="سحب طلب المشاركة"
                  action={async () => {
                    await api(`/event-applications/${a.id}/withdraw`, 'POST');
                    reload();
                  }}
                />
              )}
            </>
          )}
          {e.applicationsOpen && (!a || a.status === 'WITHDRAWN') && (
            <>
              <Title>شارك بأثرك</Title>
              {roles.length > 0 && (
                <Txt>
                  رتّب حتى 3 أدوار حسب أولوية اختيارك؛ الأول الذي تختاره هو رغبتك
                  الأولى.
                </Txt>
              )}
              <Form
                fields={[
                  ...(roles.length
                    ? [
                        {
                          key: 'roleIds',
                          label: 'الأدوار حسب أولوية الاختيار',
                          kind: 'multi' as const,
                          options: roles,
                          required: true,
                        },
                      ]
                    : []),
                  ...e.questions.map((q) =>
                    field(q.id, q.text, 'multiline', q.required),
                  ),
                  field('message', 'رسالة للمنظم', 'multiline'),
                ]}
                title="إرسال طلب المشاركة"
                submit={(v) => {
                  const { roleIds, message, ...answers } = v;
                  return api(`/events/${post.id}/applications`, 'POST', {
                    roleIds,
                    message,
                    answers,
                  });
                }}
                after={reload}
              />
            </>
          )}
          {a?.status === 'ACCEPTED' && e.status === 'COMPLETED' && (
            <>
              <Button
                title="طلب شارة المشاركة"
                onPress={() => api('/badges', 'POST', { applicationId: a.id })}
              />
              <Form
                fields={[
                  select(
                    'stars',
                    'تقييم تجربتك',
                    [1, 2, 3, 4, 5].map((value) => ({
                      value,
                      label: '★'.repeat(value),
                    })),
                    true,
                  ),
                ]}
                initial={{ stars: a.rating?.stars }}
                title="حفظ التقييم"
                submit={(v) =>
                  api('/ratings', 'PUT', { ...v, applicationId: a.id })
                }
                after={reload}
              />
            </>
          )}
        </>
      )}
      {e.documentedAt && (
        <>
          <Title>الأثر الذي صنعناه</Title>
          <Txt>{e.documentation}</Txt>
          {e.documentationMedia.map((m) => (
            <Photo key={m.id} uri={m.url} />
          ))}
          {e.impactMetrics.map((m, i) => (
            <Txt key={i}>
              {m.value} {m.label}
            </Txt>
          ))}
        </>
      )}
    </Card>
  );
}
export function Manage({ id }: { id: number }) {
  return (
    <Resource<EventPage> path={`/events/${id}`}>
      {(post, reload) => <ManageContent post={post} reload={reload} />}
    </Resource>
  );
}
function ManageContent({
  post,
  reload,
}: {
  post: EventPage;
  reload: () => void;
}) {
  const { go } = useApp();
  const [tab, setTab] = useState('applications');
  const [filter, setFilter] = useState('PENDING');
  const [roleId, setRole] = useState<number>();
  const [replaceImages, setReplaceImages] = useState(false);
  if (!post.event.isOrganizer)
    return <Txt>هذه الصفحة متاحة لمنظم الفعالية.</Txt>;
  const e = post.event;
  return (
    <View style={{ gap: 16 }}>
      <Title>{post.title}</Title>
      <Row>
        {[
          ['applications', 'المتطوعون'],
          ['documentation', 'التوثيق'],
          ['badges', 'الشارات'],
          ['settings', 'الإعدادات'],
        ].map(([value, label]) => (
          <Chip
            key={value}
            title={label}
            active={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </Row>
      {tab === 'applications' && (
        <>
          <Row>
            {['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'].map((value) => (
              <Chip
                key={value}
                title={statusText[value]}
                active={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </Row>
          <Row>
            <Chip
              title="كل الأدوار"
              active={!roleId}
              onPress={() => setRole(undefined)}
            />
            {e.roles.map((r) => (
              <Chip
                key={r.id}
                title={r.name}
                active={roleId === r.id}
                onPress={() => setRole(r.id)}
              />
            ))}
          </Row>
          <List<OrganizerApplication>
            path={`/events/${post.id}/applications?${query({ status: filter, roleId })}`}
            render={(a, refresh) => (
              <Card>
                <Person person={a.applicant} />
                <Txt>{a.applicant.bio}</Txt>
                {a.applicant.age !== null && (
                  <Txt>العمر: {a.applicant.age}</Txt>
                )}
                {a.applicant.address && (
                  <Txt>
                    {a.applicant.address.city}{' '}
                    {a.applicant.address.neighborhood}
                  </Txt>
                )}
                {a.applicant.education && (
                  <Txt>{a.applicant.education.fieldOfStudy}</Txt>
                )}
                {a.applicant.workField && <Txt>{a.applicant.workField}</Txt>}
                <Txt>{a.message}</Txt>
                <Txt>
                  {a.roleChoices.map((c) => `${c.rank}. ${c.name}`).join('، ')}
                </Txt>
                {e.questions.map((q) => (
                  <Txt key={q.id}>
                    {q.text}: {a.answers[q.id] ?? '—'}
                  </Txt>
                ))}
                {a.status === 'PENDING' && (
                  <>
                    <Form
                      fields={
                        e.roles.length
                          ? [
                              select(
                                'roleId',
                                'قبول في دور',
                                e.roles.map((r) => ({
                                  value: r.id,
                                  label: r.name,
                                })),
                                true,
                              ),
                            ]
                          : []
                      }
                      title="قبول المتطوع"
                      submit={(v) =>
                        api(`/event-applications/${a.id}/accept`, 'POST', v)
                      }
                      after={refresh}
                    />
                    <Confirm
                      title="رفض الطلب"
                      action={async () => {
                        await api(`/event-applications/${a.id}/reject`, 'POST');
                        refresh();
                      }}
                    />
                  </>
                )}
                {a.status === 'ACCEPTED' && e.roles.length > 0 && (
                  <Form
                    fields={[
                      select(
                        'roleId',
                        'نقل إلى دور',
                        e.roles.map((r) => ({ value: r.id, label: r.name })),
                        true,
                      ),
                    ]}
                    initial={{ roleId: a.role?.id }}
                    title="تغيير الدور"
                    submit={(v) =>
                      api(`/event-applications/${a.id}/move`, 'POST', v)
                    }
                    after={refresh}
                  />
                )}
              </Card>
            )}
          />
        </>
      )}
      {tab === 'documentation' && (
        <Card>
          <Title>توثيق الفعالية</Title>
          <Resource<{
            data: { label: string; uses: number }[];
          }> path="/impact-labels">
            {(suggestions) =>
              suggestions.data.length > 0 ? (
                <>
                  <Txt>مؤشرات استخدمتها سابقاً</Txt>
                  <Txt>{suggestions.data.map((x) => x.label).join('، ')}</Txt>
                </>
              ) : null
            }
          </Resource>
          <Txt>موعد التوثيق: {dateText(e.documentationDueAt)}</Txt>
          {e.documentationMedia.map((m) => (
            <Photo key={m.id} uri={m.url} />
          ))}
          {e.documentedAt && (
            <Button
              subtle
              title={replaceImages ? 'الاحتفاظ بالصور' : 'استبدال صور التوثيق'}
              onPress={() => setReplaceImages(!replaceImages)}
            />
          )}
          <Form
            fields={[
              field('documentation', 'ماذا حققتم؟', 'multiline', true),
              ...(!e.documentedAt || replaceImages
                ? [
                    {
                      ...field('imageKeys', 'صور التوثيق', 'images', true),
                      maxItems: 20,
                    },
                  ]
                : []),
              {
                key: 'metrics',
                label: 'مؤشرات الأثر',
                kind: 'rows',
                fields: [
                  field('label', 'المؤشر', 'text', true),
                  field('value', 'العدد', 'number', true),
                ],
              },
            ]}
            initial={{
              documentation: e.documentation,
              metrics: e.impactMetrics,
            }}
            title={e.documentedAt ? 'تحديث التوثيق' : 'نشر التوثيق'}
            submit={(v) =>
              api(
                `/events/${post.id}/documentation`,
                e.documentedAt ? 'PATCH' : 'POST',
                v,
              )
            }
            after={reload}
          />
        </Card>
      )}
      {tab === 'badges' && (
        <List<BadgeView>
          path={`/badges/event/${post.id}`}
          render={(b, refresh) => (
            <Card>
              <Person person={b.holder} />
              <Txt>
                {statusText[b.status]} · {b.role?.name}
              </Txt>
              {b.status === 'REQUESTED' && (
                <>
                  <Form
                    fields={[field('description', 'وصف المساهمة', 'multiline')]}
                    title="منح الشارة"
                    submit={(v) => api(`/badges/${b.id}/approve`, 'POST', v)}
                    after={refresh}
                  />
                  <Confirm
                    title="رفض الشارة"
                    action={async () => {
                      await api(`/badges/${b.id}/reject`, 'POST');
                      refresh();
                    }}
                  />
                </>
              )}
            </Card>
          )}
        />
      )}
      {tab === 'settings' && (
        <Card>
          <Button
            title="تعديل الفعالية"
            onPress={() => go({ name: 'compose', id: post.id, kind: 'EVENT' })}
          />
          {e.status === 'OPEN' && (
            <Confirm
              title="إغلاق التقديم"
              action={async () => {
                await api(`/events/${post.id}/close`, 'POST');
                reload();
              }}
            />
          )}
          {['OPEN', 'CLOSED'].includes(e.status) && (
            <Confirm
              title="إلغاء الفعالية"
              action={async () => {
                await api(`/events/${post.id}/cancel`, 'POST');
                reload();
              }}
            />
          )}
          <Title>تكرار الفعالية</Title>
          <Form
            fields={dateFields}
            title="إنشاء نسخة بمواعيد جديدة"
            submit={async (v) => {
              const copy = await api<{ id: number }>(
                `/events/${post.id}/clone`,
                'POST',
                v,
              );
              go({ name: 'post', id: copy.id, kind: 'EVENT' });
            }}
          />
        </Card>
      )}
    </View>
  );
}

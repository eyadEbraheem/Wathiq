import React, { useState } from 'react';
import { View } from 'react-native';
import { ORGANIZATION_PAPERS } from '@csh/shared';
import type { UserCard } from '@csh/shared';
import { api, appendFile } from './api';
import { Button, Card, Chip, Confirm, Photo, Row, Title, Txt } from './ui';
import { Form, field } from './forms';
import { membershipFields, select } from './catalog';
import { List, Resource, dateText, statusText, useApp } from './state';
import { Person } from './feed';
import { openLink } from './details';

export interface PublishRequest {
  id: number;
  status: string;
  title: string;
  body: string;
  createdAt: string;
  toPlatform: boolean;
  images: string[];
  caseDetails: {
    contactPhone: string;
    paymentQrUrl?: string;
    paymentNote?: string;
  } | null;
  requestedAttribution?: string;
  rejectionReason: string;
  resultingPostId: number | null;
  requester: UserCard;
  targetUser: UserCard | null;
  section: { id: number; nameAr: string };
}
export function Requests({ platform = false }: { platform?: boolean }) {
  const { me, go } = useApp();
  const [tab, setTab] = useState(me.verifiedKind ? 'incoming' : 'mine');
  const [status, setStatus] = useState('PENDING');
  const decision = platform || tab === 'incoming';
  return (
    <View style={{ gap: 16 }}>
      <Title>{platform ? 'طلبات النشر للمنصة' : 'طلبات النشر'}</Title>
      {!platform && (
        <Row>
          <Chip
            title="طلباتي"
            active={tab === 'mine'}
            onPress={() => setTab('mine')}
          />
          {me.verifiedKind && (
            <Chip
              title="الواردة"
              active={tab === 'incoming'}
              onPress={() => setTab('incoming')}
            />
          )}
          {!me.verifiedKind && (
            <Button title="طلب جديد" onPress={() => go({ name: 'compose' })} />
          )}
        </Row>
      )}
      <Row>
        {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <Chip
            key={s}
            title={statusText[s]}
            active={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </Row>
      <List<PublishRequest>
        path={`/publish-requests/${platform ? 'platform' : tab}?status=${status}`}
        render={(r, reload) => (
          <Card>
            <Person person={r.requester} />
            <Title>{r.title}</Title>
            <Txt>
              {r.section.nameAr} · {statusText[r.status]}
            </Txt>
            <Txt>{r.body}</Txt>
            {r.images.map((url, i) => (
              <Photo key={i} uri={url} />
            ))}
            {r.caseDetails && (
              <>
                <Txt>{r.caseDetails.contactPhone}</Txt>
                <Txt>{r.caseDetails.paymentNote}</Txt>
                {r.caseDetails.paymentQrUrl && (
                  <Photo uri={r.caseDetails.paymentQrUrl} />
                )}
              </>
            )}
            {r.requestedAttribution && (
              <Txt>
                نسبة النشر:{' '}
                {r.requestedAttribution === 'REQUESTER'
                  ? 'لصاحب الطلب'
                  : 'للناشر'}
              </Txt>
            )}
            {r.rejectionReason && <Txt>سبب الرفض: {r.rejectionReason}</Txt>}
            {r.resultingPostId && (
              <Button
                title="عرض المنشور"
                onPress={() => go({ name: 'post', id: r.resultingPostId! })}
              />
            )}
            {r.status === 'PENDING' &&
              (decision ? (
                <PublishDecision
                  request={r}
                  platform={platform}
                  reload={reload}
                />
              ) : (
                <Confirm
                  title="إلغاء الطلب"
                  action={async () => {
                    await api(`/publish-requests/${r.id}/cancel`, 'POST');
                    reload();
                  }}
                />
              ))}
          </Card>
        )}
      />
    </View>
  );
}
function PublishDecision({
  request: r,
  platform,
  reload,
}: {
  request: PublishRequest;
  platform: boolean;
  reload: () => void;
}) {
  const { sections } = useApp();
  return (
    <>
      <Form
        fields={[
          ...(!platform
            ? [
                select(
                  'attribution',
                  'نسبة المنشور',
                  [
                    { value: 'REQUESTER', label: 'مع ذكر صاحب الطلب' },
                    { value: 'PUBLISHER', label: 'باسمي' },
                  ],
                  true,
                ),
              ]
            : []),
          {
            key: 'topicIds',
            label: 'مواضيع المنشور',
            kind: 'multi',
            options: sections
              .find((s) => s.id === r.section.id)
              ?.topics.map((t) => ({ value: t.id, label: t.nameAr })),
          },
        ]}
        initial={{ attribution: 'REQUESTER' }}
        title="الموافقة والنشر"
        submit={(v) => api(`/publish-requests/${r.id}/approve`, 'POST', v)}
        after={reload}
      />
      <Form
        fields={[field('reason', 'سبب الرفض')]}
        title="رفض الطلب"
        submit={(v) => api(`/publish-requests/${r.id}/reject`, 'POST', v)}
        after={reload}
      />
    </>
  );
}
interface Collaboration {
  id: number;
  status: string;
  inviter: UserCard;
  invitee: UserCard;
  post: { id: number; title: string; kind: string };
}
export function Collaborations({ postId }: { postId?: number }) {
  const { go } = useApp();
  const [revision, setRevision] = useState(0);
  return (
    <View style={{ gap: 16 }}>
      <Title>{postId ? 'إدارة المتعاونين' : 'دعوات التعاون'}</Title>
      {postId && (
        <Card>
          <Txt>
            اختر الحساب من دليل الحسابات، ثم استخدم رقمه الموجود في ملفه.
          </Txt>
          <Button
            subtle
            title="دليل الحسابات"
            onPress={() => go({ name: 'search' })}
          />
          <Form
            fields={[field('inviteeId', 'رقم حساب المتعاون', 'number', true)]}
            title="إرسال دعوة تعاون"
            submit={(v) => api(`/posts/${postId}/collaborations`, 'POST', v)}
            after={() => setRevision((n) => n + 1)}
          />
        </Card>
      )}
      <List<Collaboration>
        revision={revision}
        path={
          postId
            ? `/posts/${postId}/collaborations`
            : '/collaborations/incoming'
        }
        render={(c, reload) => (
          <Card>
            <Person person={postId ? c.invitee : c.inviter} />
            <Title>{c.post.title}</Title>
            <Txt>{statusText[c.status]}</Txt>
            <Button
              subtle
              title="عرض المنشور"
              onPress={() =>
                go({ name: 'post', id: c.post.id, kind: c.post.kind })
              }
            />
            {!postId && c.status === 'PENDING' && (
              <Row>
                <Button
                  title="قبول التعاون"
                  onPress={async () => {
                    await api(`/collaborations/${c.id}/accept`, 'POST');
                    reload();
                  }}
                />
                <Confirm
                  title="رفض الدعوة"
                  action={async () => {
                    await api(`/collaborations/${c.id}/decline`, 'POST');
                    reload();
                  }}
                />
              </Row>
            )}
            {((postId && ['PENDING', 'ACCEPTED'].includes(c.status)) ||
              (!postId && c.status === 'ACCEPTED')) && (
              <Confirm
                title={postId ? 'إلغاء التعاون' : 'مغادرة التعاون'}
                action={async () => {
                  await api(`/collaborations/${c.id}/cancel`, 'POST');
                  reload();
                }}
              />
            )}
          </Card>
        )}
      />
    </View>
  );
}
interface Membership {
  id: number;
  status: string;
  role: string;
  description: string;
  startYear: number | null;
  endYear: number | null;
  team?: UserCard;
  user?: UserCard;
}
export function JoinTeam({ id }: { id: number }) {
  const { back } = useApp();
  return (
    <Card>
      <Title>طلب الانضمام للفريق</Title>
      <Form
        fields={membershipFields}
        title="إرسال الطلب"
        submit={(v) => api('/team-memberships', 'POST', { ...v, teamId: id })}
        after={back}
      />
    </Card>
  );
}
export function Teams({ incoming = false }: { incoming?: boolean }) {
  const [edit, setEdit] = useState<number>();
  return (
    <>
      <Title>{incoming ? 'أعضاء الفريق وطلباتهم' : 'عضوياتي'}</Title>
      <List<Membership>
        path={`/team-memberships/${incoming ? 'incoming' : 'me'}`}
        render={(m, reload) => (
          <Card>
            {(m.team ?? m.user) && <Person person={(m.team ?? m.user)!} />}
            <Txt>
              {m.role} · {statusText[m.status]}
            </Txt>
            <Txt>{m.description}</Txt>
            <Txt>
              {m.startYear ?? '—'} — {m.endYear ?? 'الآن'}
            </Txt>
            {!incoming && ['PENDING', 'APPROVED'].includes(m.status) && (
              <>
                <Button
                  subtle
                  title="تعديل العضوية"
                  onPress={() => setEdit(edit === m.id ? undefined : m.id)}
                />
                {edit === m.id && (
                  <Form
                    fields={membershipFields}
                    initial={{ ...m }}
                    submit={(v) => api(`/team-memberships/${m.id}`, 'PATCH', v)}
                    after={() => {
                      setEdit(undefined);
                      reload();
                    }}
                  />
                )}
                {m.status === 'PENDING' && (
                  <Confirm
                    title="إلغاء طلب العضوية"
                    action={async () => {
                      await api(`/team-memberships/${m.id}`, 'DELETE');
                      reload();
                    }}
                  />
                )}
              </>
            )}
            {incoming && m.status === 'PENDING' && (
              <Row>
                <Button
                  title="قبول العضوية"
                  onPress={async () => {
                    await api(`/team-memberships/${m.id}/approve`, 'POST');
                    reload();
                  }}
                />
                <Confirm
                  title="رفض العضوية"
                  action={async () => {
                    await api(`/team-memberships/${m.id}/reject`, 'POST');
                    reload();
                  }}
                />
              </Row>
            )}
            {incoming && m.status === 'APPROVED' && (
              <Confirm
                title="إزالة العضو"
                action={async () => {
                  await api(`/team-memberships/${m.id}/remove`, 'POST');
                  reload();
                }}
              />
            )}
          </Card>
        )}
      />
    </>
  );
}
export interface Verification {
  id: number;
  status: string;
  kind: string;
  contactPhone: string;
  foundedAt: string | null;
  details: string;
  links: string[];
  createdAt: string;
  rejectionReason: string;
  user?: UserCard;
  documents?: { id: number; fileName: string; url: string | null }[];
}
export function Verify() {
  const { me } = useApp();
  const pendingOrganization = me.pendingOrganization === true;
  const [revision, setRevision] = useState(0);
  return (
    <View style={{ gap: 16 }}>
      <Title>توثيق الحساب</Title>
      <Txt>
        التوثيق يفتح لك النشر وتنظيم الفعاليات. وثائق الهوية تصل إلى فريق
        المراجعة بشكل خاص.
      </Txt>
      {!me.verifiedKind && (
        <Card>
          <Form
            fields={[
              select(
                'kind',
                'نوع الحساب',
                [
                  { value: 'ORGANIZATION', label: 'منظمة أو فريق' },
                  { value: 'INDIVIDUAL', label: 'فرد' },
                ],
                true,
              ),
              field('contactPhone', 'هاتف التواصل (+963…)', 'text', true),
              {
                ...field('foundedAt', 'تاريخ التأسيس', 'date', true),
                when: (v) => v.kind === 'ORGANIZATION',
              },
              field('details', 'عن أعمالك السابقة', 'multiline'),
              field('links', 'روابط الأعمال (كل رابط في سطر)', 'strings'),
              select(
                'idDocumentType',
                'نوع الوثيقة',
                [
                  { value: 'ID_CARD', label: 'هوية شخصية' },
                  { value: 'PASSPORT', label: 'جواز سفر' },
                ],
                true,
              ),
              field(
                'idDocument',
                'وثيقة الهوية (صورة أو PDF، حتى 10 MB)',
                'file',
                true,
              ),
              field(
                'supporting',
                'وثائق داعمة (حتى 3 ملفات، 10 MB للملف)',
                'files',
              ),
              {
                key: 'papers',
                label: 'أوراق الجمعية (3 ملفات إلزامية)',
                kind: 'files',
                required: true,
                maxItems: 3,
                when: (v) => v.kind === 'ORGANIZATION',
              },
            ]}
            initial={{
              kind: pendingOrganization ? 'ORGANIZATION' : 'INDIVIDUAL',
              idDocumentType: 'ID_CARD',
              foundedAt: pendingOrganization ? me.birthDate : undefined,
            }}
            title="إرسال طلب التوثيق"
            submit={async (v) => {
              const body = new FormData();
              for (const [key, value] of Object.entries(v)) {
                if (
                  key === 'idDocument' ||
                  key === 'supporting' ||
                  key === 'papers'
                ) {
                  const files = value as {
                    uri: string;
                    name: string;
                    mimeType?: string;
                    size?: number;
                  }[];
                  if (files.length > (key === 'idDocument' ? 1 : 3))
                    throw new Error('عدد الوثائق أكبر من الحد المسموح.');
                  if (
                    key === 'papers' &&
                    files.length !== ORGANIZATION_PAPERS.length
                  )
                    throw new Error(
                      `أرفق ${ORGANIZATION_PAPERS.length} أوراق للجمعية.`,
                    );
                  for (const file of files) {
                    if ((file.size ?? 0) > 10 * 1024 * 1024)
                      throw new Error('حجم الوثيقة يتجاوز 10 MB.');
                    appendFile(body, key, file);
                  }
                } else if (Array.isArray(value))
                  value.forEach((item) => body.append(key, String(item)));
                else body.append(key, String(value));
              }
              await api('/verification-requests', 'POST', body);
            }}
            after={() => setRevision((n) => n + 1)}
          />
        </Card>
      )}
      <List<Verification>
        path="/verification-requests/me"
        revision={revision}
        render={(v) => (
          <Card>
            <Txt>
              {statusText[v.status]} · {dateText(v.createdAt)}
            </Txt>
            <Txt>{v.details}</Txt>
            {v.rejectionReason && <Txt>سبب الرفض: {v.rejectionReason}</Txt>}
          </Card>
        )}
      />
    </View>
  );
}
export function VerificationReview({ id }: { id: number }) {
  const { back } = useApp();
  return (
    <Resource<Verification> path={`/verification-requests/${id}`}>
      {(v) => (
        <Card>
          <Title>مراجعة طلب التوثيق</Title>
          {v.user && <Person person={v.user} />}
          <Txt>
            {v.kind === 'ORGANIZATION' ? 'منظمة / فريق' : 'فرد'} ·{' '}
            {v.contactPhone}
          </Txt>
          {v.foundedAt && <Txt>تاريخ التأسيس: {v.foundedAt}</Txt>}
          <Txt>{v.details}</Txt>
          {v.links.map((link, i) => (
            <Button
              key={i}
              subtle
              title={link}
              onPress={() => openLink(link)}
            />
          ))}
          {v.documents?.map((doc) => (
            <Button
              key={doc.id}
              subtle
              title={doc.fileName}
              disabled={!doc.url}
              onPress={() => openLink(doc.url!)}
            />
          ))}
          <Txt>روابط الوثائق مؤقتة؛ أعد فتح الطلب إذا انتهت صلاحيتها.</Txt>
          {v.status === 'PENDING' && (
            <>
              <Button
                title="توثيق الحساب"
                onPress={async () => {
                  await api(`/verification-requests/${id}/approve`, 'POST');
                  back();
                }}
              />
              <Form
                fields={[field('reason', 'سبب الرفض', 'multiline', true)]}
                title="رفض التوثيق"
                submit={(v) =>
                  api(`/verification-requests/${id}/reject`, 'POST', v)
                }
                after={back}
              />
            </>
          )}
        </Card>
      )}
    </Resource>
  );
}
export function Report({ id, kind }: { id: number; kind: string }) {
  return (
    <Card>
      <Title>الإبلاغ عن محتوى</Title>
      <Form
        fields={[
          select(
            'reason',
            'سبب الإبلاغ',
            Object.entries({
              FRAUD: 'احتيال',
              OFFENSIVE: 'محتوى مسيء',
              SPAM: 'إزعاج',
              MISLEADING: 'معلومات مضللة',
              OTHER: 'سبب آخر',
            }).map(([value, label]) => ({ value, label })),
            true,
          ),
          field('details', 'تفاصيل إضافية', 'multiline'),
        ]}
        title="إرسال البلاغ"
        submit={(v) =>
          api('/reports', 'POST', { ...v, target: kind, targetId: id })
        }
      />
    </Card>
  );
}

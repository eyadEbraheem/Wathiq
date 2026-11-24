import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { EventPage, PostView } from '@csh/shared';
import { api } from './api';
import { Button, Card, Chip, Photo, Row, Title, Txt } from './ui';
import { Fields, encode, field, type Field, type Values } from './forms';
import {
  caseField,
  dateFields,
  eventFields,
  opportunityField,
  sectionField,
  select,
} from './catalog';
import { Resource, useApp } from './state';

export function Compose({
  id,
  kind,
  targetId,
}: {
  id?: number;
  kind?: string;
  targetId?: number;
}) {
  if (id)
    return (
      <Resource<PostView | EventPage>
        path={`/${kind === 'EVENT' ? 'events' : 'posts'}/${id}`}
      >
        {(post) => <Editor post={post} />}
      </Resource>
    );
  return <Editor targetId={targetId} />;
}
function Editor({
  post,
  targetId,
}: {
  post?: PostView | EventPage;
  targetId?: number;
}) {
  const { sections, me, go, back } = useApp();
  const request = !me.verifiedKind && me.role !== 'ADMIN';
  const [kind, setKind] = useState(post?.kind ?? 'POST');
  const [replaceImages, setReplaceImages] = useState(false);
  const event = post?.kind === 'EVENT' ? (post as EventPage).event : undefined;
  const initial: Values = post
    ? {
        title: post.title,
        body: post.body,
        sectionId: post.section.id,
        topicIds: post.topics.map((t) => t.id),
        ...(event
          ? {
              ...event,
              roles: event.roles.map((r) => ({
                id: r.id,
                name: r.name,
                seats: r.seats,
              })),
              questions: event.questions.map((q) => ({
                text: q.text,
                required: q.required,
              })),
            }
          : {}),
      }
    : { sectionId: sections[0]?.id, requestedAttribution: 'REQUESTER' };
  const [v, setV] = useState<Values>(initial);
  const [error, setError] = useState('');
  const section = sections.find((s) => s.id === v.sectionId);
  // Existing nested details are changed only when explicitly enabled; URLs are never treated as upload keys.
  const [replaceDetails, setReplaceDetails] = useState(!post);
  const [removeCase, setRemoveCase] = useState(false);
  const [removeOpportunity, setRemoveOpportunity] = useState(false);
  const fields: Field[] = [
    ...(!post ? [sectionField(sections)] : []),
    field('title', 'عنوان المبادرة', 'text', true),
    field('body', 'احكِ لنا عنها', 'multiline', true),
    ...(!request
      ? [
          {
            key: 'topicIds',
            label: 'المواضيع',
            kind: 'multi' as const,
            options: section?.topics.map((t) => ({
              value: t.id,
              label: t.nameAr,
            })),
          },
        ]
      : []),
    ...(!post || replaceImages
      ? [
          field(
            'imageKeys',
            post ? 'الصور البديلة (تستبدل جميع الصور الحالية)' : 'صور المبادرة',
            'images',
          ),
        ]
      : []),
    ...(kind === 'EVENT'
      ? eventFields
      : replaceDetails
        ? [
            ...(section?.slug === 'humanitarian' ? [caseField] : []),
            ...(!request && section?.slug === 'education'
              ? [opportunityField]
              : []),
          ]
        : []),
    ...(request && !targetId
      ? [
          select(
            'requestedAttribution',
            'باسم من يُنشر؟',
            [
              { value: 'REQUESTER', label: 'باسمي' },
              { value: 'PUBLISHER', label: 'باسم واثق' },
            ],
            true,
          ),
        ]
      : []),
  ];
  return (
    <View style={{ gap: 16 }}>
      <Title>
        {post ? 'تعديل المحتوى' : request ? 'طلب نشر' : 'نزرع أثراً جديداً'}
      </Title>
      {!post && !request && (
        <Row>
          <Chip
            title="منشور"
            active={kind === 'POST'}
            onPress={() => setKind('POST')}
          />
          <Chip
            title="فعالية تطوعية"
            active={kind === 'EVENT'}
            onPress={() => setKind('EVENT')}
          />
        </Row>
      )}
      {request && (
        <Txt>
          {targetId
            ? 'سيصل طلبك إلى الحساب الذي اخترته.'
            : 'سيصل طلبك لفريق واثق لمراجعته ونشره.'}
        </Txt>
      )}
      <Card>
        {post && (
          <>
            <Txt>تبقى الصور الحالية إن لم تختر استبدالها.</Txt>
            {post.media.map((img) => (
              <Photo key={img.id} uri={img.url} />
            ))}
            <Button
              subtle
              title={
                replaceImages ? 'الاحتفاظ بالصور الحالية' : 'استبدال الصور'
              }
              onPress={() => {
                setReplaceImages(!replaceImages);
                setV({ ...v, imageKeys: [] });
              }}
            />
            {kind === 'POST' && (
              <>
                <Button
                  subtle
                  title={
                    replaceDetails
                      ? 'الاحتفاظ بالتفاصيل الحالية'
                      : 'تغيير تفاصيل الحالة أو الفرصة'
                  }
                  onPress={() => setReplaceDetails(!replaceDetails)}
                />
                {post.caseDetails && (
                  <Chip
                    title="حذف تفاصيل الحالة"
                    active={removeCase}
                    onPress={() => setRemoveCase(!removeCase)}
                  />
                )}
                {post.opportunity && (
                  <Chip
                    title="حذف تفاصيل الفرصة"
                    active={removeOpportunity}
                    onPress={() => setRemoveOpportunity(!removeOpportunity)}
                  />
                )}
              </>
            )}
          </>
        )}
        <Fields
          fields={fields}
          values={v}
          change={(next) => {
            if (next.sectionId !== v.sectionId) {
              next.topicIds = [];
              next.caseDetails = undefined;
              next.opportunity = undefined;
            }
            setV(next);
          }}
        />
        {!!error && <Txt style={{ color: '#B84863' }}>{error}</Txt>}
        <Button
          title={post ? 'حفظ التعديلات' : request ? 'إرسال طلب النشر' : 'نشر'}
          onPress={async () => {
            setError('');
            try {
              const payload = encode(fields, v);
              if (post) {
                const previous = encode(
                  fields.map((f) => ({ ...f, required: false })),
                  initial,
                );
                for (const key of Object.keys(payload)) {
                  if (
                    JSON.stringify(payload[key]) ===
                    JSON.stringify(previous[key])
                  )
                    delete payload[key];
                }
                delete payload.sectionId;
                if (removeCase) payload.caseDetails = null;
                if (removeOpportunity) payload.opportunity = null;
              }
              if (
                kind === 'EVENT' &&
                (payload.roles as unknown[] | undefined)?.length
              )
                delete payload.capacity;
              const result = await api<{ id: number }>(
                request
                  ? '/publish-requests'
                  : `/${kind === 'EVENT' ? 'events' : 'posts'}${post ? `/${post.id}` : ''}`,
                post ? 'PATCH' : 'POST',
                {
                  ...payload,
                  ...(request && targetId ? { targetUserId: targetId } : {}),
                },
              );
              Alert.alert(
                'تم بنجاح',
                request ? 'وصل طلب النشر.' : 'تم حفظ المحتوى.',
              );
              if (post) back();
              else
                go(
                  request
                    ? { name: 'requests' }
                    : { name: 'post', id: result.id, kind },
                );
            } catch (e) {
              setError(e instanceof Error ? e.message : 'تعذّر الحفظ');
            }
          }}
        />
      </Card>
    </View>
  );
}

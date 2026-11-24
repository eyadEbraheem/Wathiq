// "منشوراتي ومبادراتي": a verified account's own posts and events (GET /users/me/posts), the
// same list as the web page /my-posts. Find by type, event status or title, see what waits.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { PostView } from '@csh/shared';
import { Resource, dateText, statusText, useApp } from './state';
import {
  Button,
  Card,
  Chip,
  Input,
  Photo,
  Row,
  Title,
  Txt,
  useColors,
} from './ui';

type MyPost = PostView & {
  waiting: { applications: number; badges: number } | null;
};
interface MyPostsPage {
  data: MyPost[];
  meta: { page: number; totalPages: number; total: number };
  counts: { all: number; posts: number; events: number; hidden: number };
}

const TABS = [
  ['all', 'الكل'],
  ['events', 'الفعاليات'],
  ['posts', 'المنشورات'],
  ['hidden', 'أخفتها الإدارة'],
] as const;
type Tab = (typeof TABS)[number][0];
const EVENT_STATUSES = ['OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED'] as const;
const right = { textAlign: 'right' as const };

export function MyPosts() {
  const { go } = useApp();
  const c = useColors();
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState<string>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: '15' });
  if (tab === 'events') params.set('kind', 'EVENT');
  if (tab === 'posts') params.set('kind', 'POST');
  if (tab === 'hidden') params.set('hidden', 'true');
  if (tab === 'events' && status) params.set('eventStatus', status);
  if (q) params.set('q', q);
  const path = `/users/me/posts?${params.toString()}`;

  return (
    <View style={{ gap: 14 }}>
      <Title>منشوراتي ومبادراتي</Title>
      <Button
        title="منشور أو فعالية جديدة"
        onPress={() => go({ name: 'compose' })}
      />
      <Input label="ابحث في العناوين" value={text} onChange={setText} />
      <Button
        subtle
        title="بحث"
        onPress={() => {
          setQ(text.trim());
          setPage(1);
        }}
      />
      <Resource<MyPostsPage> key={path} path={path}>
        {(res, reload) => (
          <View style={{ gap: 10 }}>
            <Row>
              {TABS.map(([key, label]) => (
                <Chip
                  key={key}
                  title={`${label} (${res.counts[key === 'events' ? 'events' : key === 'posts' ? 'posts' : key === 'hidden' ? 'hidden' : 'all']})`}
                  active={tab === key}
                  onPress={() => {
                    setTab(key);
                    setStatus(undefined);
                    setPage(1);
                  }}
                />
              ))}
            </Row>
            {tab === 'events' && (
              <Row>
                <Chip
                  title="كل الحالات"
                  active={!status}
                  onPress={() => setStatus(undefined)}
                />
                {EVENT_STATUSES.map((s) => (
                  <Chip
                    key={s}
                    title={statusText[s] ?? s}
                    active={status === s}
                    onPress={() => {
                      setStatus(s);
                      setPage(1);
                    }}
                  />
                ))}
              </Row>
            )}
            {!res.data.length && (
              <Card>
                <Txt>
                  {q ? `لا شيء بعنوان فيه «${q}».` : 'لا يوجد شيء هنا بعد.'}
                </Txt>
              </Card>
            )}
            {res.data.map((p) => {
              const ev = p.event;
              return (
                <Card key={p.id}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => go({ name: 'post', id: p.id, kind: p.kind })}
                    style={{ gap: 8 }}
                  >
                    {p.media[0] ? <Photo uri={p.media[0].url} /> : null}
                    <Txt style={{ ...right, fontSize: 12, color: c.muted }}>
                      {[
                        p.section.nameAr,
                        p.kind === 'EVENT'
                          ? 'فعالية'
                          : p.opportunity
                            ? 'فرصة'
                            : 'منشور',
                        ev ? statusText[ev.status] : '',
                        p.status === 'HIDDEN' ? 'أخفته الإدارة' : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                    <Txt
                      style={{
                        ...right,
                        fontFamily: 'TajawalBold',
                        fontSize: 17,
                      }}
                    >
                      {p.title}
                    </Txt>
                    <Txt style={{ ...right, fontSize: 12, color: c.muted }}>
                      {ev ? `موعدها ${dateText(ev.startsAt)} · ` : ''}
                      {p.upvoteCount} رفعة · {p.commentCount} تعليق
                      {ev && ev.capacity !== null
                        ? ` · ${ev.acceptedCount} من ${ev.capacity} مقعد`
                        : ''}
                    </Txt>
                    {p.waiting &&
                    (p.waiting.applications > 0 || p.waiting.badges > 0) ? (
                      <Txt
                        style={{
                          ...right,
                          fontSize: 13,
                          color: '#8D6B25',
                          fontFamily: 'TajawalBold',
                        }}
                      >
                        ينتظر ردّكم:
                        {p.waiting.applications
                          ? ` ${p.waiting.applications} طلب تطوع`
                          : ''}
                        {p.waiting.applications && p.waiting.badges ? ' ·' : ''}
                        {p.waiting.badges
                          ? ` ${p.waiting.badges} طلب شارة`
                          : ''}
                      </Txt>
                    ) : null}
                  </Pressable>
                  <Row>
                    {p.kind === 'EVENT' && (
                      <Button
                        title="إدارة الفعالية"
                        onPress={() => go({ name: 'manage', id: p.id })}
                      />
                    )}
                    <Button
                      subtle
                      title="تعديل"
                      onPress={() =>
                        go({ name: 'compose', id: p.id, kind: p.kind })
                      }
                    />
                  </Row>
                </Card>
              );
            })}
            {res.meta.totalPages > 1 && (
              <Row>
                <Button
                  subtle
                  title="السابق"
                  disabled={page <= 1}
                  onPress={() => setPage((n) => n - 1)}
                />
                <Txt>
                  {page} / {res.meta.totalPages}
                </Txt>
                <Button
                  subtle
                  title="التالي"
                  disabled={page >= res.meta.totalPages}
                  onPress={() => setPage((n) => n + 1)}
                />
              </Row>
            )}
            <Button subtle title="تحديث" onPress={reload} />
          </View>
        )}
      </Resource>
    </View>
  );
}

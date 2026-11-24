import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SECTION_COLORS,
  type SectionSlug,
  type PostView,
  type UserCard,
} from '@csh/shared';
import { api } from './api';
import { CategoryTree } from './CategoryTree';
import { Button, Card, Chip, Photo, Row, Title, Txt, useColors } from './ui';
import { List, dateText, query, statusText, useApp } from './state';
import { Form, field } from './forms';
import { governorates, select } from './catalog';
import { isOrganization } from './accounts';
import { WeeklyHighlightCard } from './discover';

export function Person({
  person,
}: {
  person: Pick<UserCard, 'id' | 'name'> & Partial<UserCard>;
}) {
  const { go } = useApp();
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`ملف ${person.name}`}
      onPress={() => go({ name: 'user', id: person.id })}
      style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
    >
      {person.avatarUrl ? (
        <Image
          source={{ uri: person.avatarUrl }}
          style={{ width: 44, height: 44, borderRadius: 16 }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: c.icy,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt style={{ fontSize: 22 }}>{person.name.slice(0, 1)}</Txt>
        </View>
      )}
      <Txt style={{ fontFamily: 'TajawalBold', flexShrink: 1 }}>
        {person.name}
      </Txt>
      {!!person.verifiedKind && (
        <Ionicons
          accessibilityLabel="حساب موثّق"
          name="checkmark-circle"
          size={18}
          color={c.primaryInk}
        />
      )}
    </Pressable>
  );
}
export function PostCard({
  post,
  reload,
}: {
  post: PostView;
  reload: () => void;
}) {
  const { go, dark, me } = useApp();
  const color =
    SECTION_COLORS[post.section.slug as SectionSlug]?.[dark ? 'dark' : 'light']
      .ink ?? '#198996';
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`تفاصيل ${post.title}`}
        onPress={() => go({ name: 'post', id: post.id, kind: post.kind })}
        style={{
          marginHorizontal: -14,
          marginTop: -14,
          overflow: 'hidden',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
        }}
      >
        {post.media[0] ? (
          <Image
            source={{ uri: post.media[0].url }}
            style={{ width: '100%', height: 180 }}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#198996', '#1FA383', '#13263A']}
            style={{
              height: 180,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={icons[post.section.slug] ?? 'sparkles-outline'}
              size={72}
              color="#FFFFFF80"
            />
          </LinearGradient>
        )}
        <View
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: '#13263A99',
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 18,
          }}
        >
          <Txt
            style={{ color: '#fff', fontFamily: 'TajawalBold', fontSize: 12 }}
          >
            {post.section.nameAr}
          </Txt>
        </View>
        <LinearGradient
          colors={['transparent', '#13263ADD']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 12,
            paddingTop: 26,
          }}
        >
          <Txt
            style={{
              color: '#fff',
              fontFamily: 'TajawalBold',
              textAlign: 'right',
            }}
          >
            {post.author.name}
            {post.author.verifiedKind ? ' ✓' : ''}
          </Txt>
        </LinearGradient>
      </Pressable>
      <Person person={post.author} />
      <Row>
        <Txt style={{ color, fontSize: 13 }}>{post.section.nameAr}</Txt>
        <Txt style={{ fontSize: 12 }}>{dateText(post.createdAt)}</Txt>
      </Row>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`عرض ${post.title}`}
        onPress={() => go({ name: 'post', id: post.id, kind: post.kind })}
        style={{ gap: 10 }}
      >
        <Title>{post.title}</Title>
        <Txt numberOfLines={3}>{post.body}</Txt>
        {!!post.event && (
          <View style={{ gap: 6 }}>
            <Txt>◷ {dateText(post.event.startsAt)}</Txt>
            <Txt>
              {post.event.city} · {statusText[post.event.status]} ·{' '}
              {post.event.seatsLeft === null
                ? 'مقاعد غير محدودة'
                : `${post.event.seatsLeft} مقعد متاح`}
            </Txt>
          </View>
        )}
        {!!post.opportunity && (
          <Txt>
            {post.opportunity.isOpen ? 'فرصة متاحة للتقديم' : 'انتهى التقديم'}
          </Txt>
        )}
      </Pressable>
      <Row wrap={false}>
        {post.event && !isOrganization(me) && (
          <Button
            title="تطوع الآن"
            onPress={() => go({ name: 'post', id: post.id, kind: post.kind })}
          />
        )}
        <Button
          subtle
          title="التفاصيل"
          onPress={() => go({ name: 'post', id: post.id, kind: post.kind })}
        />
      </Row>
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
            title={`التعليقات ${post.commentCount}`}
            onPress={() => go({ name: 'post', id: post.id, kind: post.kind })}
          />
        </Row>
      )}
    </Card>
  );
}
const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  humanitarian: 'heart-outline',
  environment: 'leaf-outline',
  'animal-welfare': 'paw-outline',
  community: 'people-outline',
  education: 'school-outline',
};
export function Feed({
  events = false,
  authorId,
}: {
  events?: boolean;
  authorId?: number;
}) {
  const { sections, me, dark, go } = useApp();
  const c = useColors();
  const [sectionId, setSection] = useState<number | undefined>(
    authorId
      ? undefined
      : (me.primarySectionId ??
          (events
            ? undefined
            : sections.find((s) => s.slug === 'humanitarian')?.id)),
  );
  const [topicId, setTopic] = useState<number>();
  const [sort, setSort] = useState('newest');
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [cases, setCases] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const selected = sections.find((s) => s.id === sectionId);
  const topicScroll = useRef<ScrollView>(null);
  return (
    <View style={{ gap: 16 }}>
      {!authorId && !events && <WeeklyHighlightCard />}
      {!authorId && (
        <Card>
          <CategoryTree
            selected={sectionId}
            onSelect={(id) => {
              setSection(id);
              setTopic(undefined);
            }}
          />
          <ScrollView
            key={sectionId ?? 'all'}
            ref={topicScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() =>
              topicScroll.current?.scrollToEnd({ animated: false })
            }
            style={{
              direction: 'ltr',
              borderTopWidth: 1,
              borderTopColor: c.line,
              paddingTop: 12,
            }}
            contentContainerStyle={{
              direction: 'ltr',
              flexDirection: 'row-reverse',
              flexGrow: 1,
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Chip
              title={events ? 'كل المجالات' : 'مجالي الأساسي'}
              active={!sectionId}
              onPress={() => {
                setSection(
                  events
                    ? undefined
                    : (me.primarySectionId ??
                        sections.find((s) => s.slug === 'humanitarian')?.id),
                );
                setTopic(undefined);
              }}
            />
            {selected?.topics.map((t) => (
              <Chip
                key={t.id}
                title={t.nameAr}
                active={topicId === t.id}
                onPress={() => setTopic(topicId === t.id ? undefined : t.id)}
              />
            ))}
          </ScrollView>
        </Card>
      )}
      {!authorId && (
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Txt
            style={{
              fontFamily: 'Cairo',
              fontSize: 15,
              lineHeight: 27,
              flexShrink: 1,
              color: c.ink,
            }}
          >
            {events ? 'فرص تصنع فرقاً' : 'المبادرات المجتمعية'}
          </Txt>
          {!events && (
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 16,
                padding: 4,
              }}
            >
              <Chip
                title="الأحدث"
                active={sort === 'newest'}
                onPress={() => setSort('newest')}
              />
              <Chip
                title="الأكثر تفاعلاً"
                active={sort === 'top'}
                onPress={() => setSort('top')}
              />
            </View>
          )}
        </View>
      )}
      {!events && (
        <Row wrap={false}>
          {selected?.slug === 'humanitarian' && (
            <Chip
              title="الحالات الإنسانية"
              active={cases}
              onPress={() => setCases(!cases)}
            />
          )}
          {selected?.slug === 'education' && (
            <Chip
              title="الفرص المتاحة فقط"
              active={openOnly}
              onPress={() => setOpenOnly(!openOnly)}
            />
          )}
        </Row>
      )}
      <Row wrap={false}>
        {events && (
          <Button
            subtle
            title="تصفية النتائج"
            onPress={() => setShowFilters(!showFilters)}
          />
        )}
      </Row>
      {showFilters && (
        <Card>
          <Form
            fields={[
              select('governorate', 'المحافظة', governorates),
              select(
                'status',
                'حالة الفعالية',
                ['OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED'].map((value) => ({
                  value,
                  label: statusText[value],
                })),
              ),
            ]}
            title="تطبيق"
            initial={filters}
            submit={async (v) => {
              setFilters(v);
              setShowFilters(false);
            }}
          />
          <Button
            subtle
            title="مسح التصفية"
            onPress={() => {
              setFilters({});
              setShowFilters(false);
            }}
          />
        </Card>
      )}
      <List<PostView>
        path={`/${events ? 'events' : 'posts'}?${query({ sectionId, topicId, ...(!events ? { sort, cases: selected?.slug === 'humanitarian' && cases ? true : undefined, openOpportunities: selected?.slug === 'education' && openOnly ? true : undefined } : filters), authorId })}`}
        render={(post, reload) => <PostCard post={post} reload={reload} />}
      />
    </View>
  );
}

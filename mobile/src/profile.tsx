import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import { EDUCATION_LABELS_AR, GOVERNORATE_LABELS_AR } from '@csh/shared';
import type {
  AuthTokens,
  ApplicationView,
  BadgeView,
  Interests,
  OrganizerStats,
  Paginated,
  ProfileTeam,
  PublicProfileView,
  UserCard,
  VolunteerCv,
} from '@csh/shared';
import { api, clearSession, downloadAuthenticated, setSession } from './api';
import {
  Button,
  Card,
  Chip,
  Confirm,
  Photo,
  Row,
  Title,
  Txt,
  useColors,
} from './ui';
import { Fields, Form, encode, field, type Values } from './forms';
import {
  education,
  governorates,
  membershipFields,
  privacyFields,
  profileFields,
  sectionField,
  select,
} from './catalog';
import {
  List,
  Resource,
  dateText,
  query,
  statusText,
  useApp,
  useResource,
} from './state';
import { Feed, Person } from './feed';
import { registerPush, unregisterPush } from './push';
import { isOrganization } from './accounts';
import { HighlightBadge } from './discover';

export function Me() {
  const { me, go, dark, toggleTheme, signOut, reloadMe } = useApp();
  const organization = isOrganization(me);
  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Person person={me} />
        <Txt>{me.bio || 'كل مساهمة تترك أثراً.'}</Txt>
        <Button
          subtle
          title="عرض ملفي العام"
          onPress={() => go({ name: 'user', id: me.id })}
        />
        <Button subtle title="تحديث الحساب" onPress={reloadMe} />
      </Card>
      {organization && <MyOrganizationStats userId={me.id} />}
      <Card>
        <Title>رحلتي على واثق</Title>
        {[
          ['profile-edit', 'تعديل الملف الشخصي'],
          ['security', 'الحساب وكلمة المرور'],
          ['interests', organization ? 'أقسام عملنا' : 'اهتماماتي'],
          ['privacy', 'الخصوصية'],
          ['applications', 'طلبات التطوع'],
          ...(!organization
            ? [
                ['badges', 'شاراتي وشهاداتي'],
                ['cv', 'سيرتي التطوعية'],
              ]
            : []),
          ['following', 'الحسابات التي أتابعها'],
          ...(!organization ? [['teams', 'عضوياتي في الفرق']] : []),
          ['collaborations', 'دعوات التعاون'],
          ['requests', 'طلبات النشر'],
          ['verify', 'توثيق الحساب'],
        ].map(([name, label]) => (
          <Button
            key={name}
            subtle
            title={label}
            onPress={() => go({ name })}
          />
        ))}
        {me.verifiedKind && (
          <>
            <Button
              subtle
              title="التقييمات الواردة"
              onPress={() => go({ name: 'ratings' })}
            />
            <Button
              subtle
              title="تخصصاتي"
              onPress={() => go({ name: 'specialties' })}
            />
            <Button
              subtle
              title="منشوراتي ومبادراتي"
              onPress={() => go({ name: 'my-posts' })}
            />
            <Button
              subtle
              title="طلبات عضوية فريقي"
              onPress={() => go({ name: 'teams', kind: 'incoming' })}
            />
          </>
        )}
        {me.role === 'ADMIN' && (
          <Button title="لوحة الإدارة" onPress={() => go({ name: 'admin' })} />
        )}
      </Card>
      <Card>
        <Title>التطبيق</Title>
        <Button
          subtle
          title={dark ? 'المظهر الفاتح' : 'المظهر الداكن'}
          onPress={toggleTheme}
        />
        <Button
          subtle
          title="تفعيل إشعارات الجهاز"
          onPress={async () => {
            await registerPush(true);
            Alert.alert('تم', 'تم ربط إشعارات هذا الجهاز.');
          }}
        />
        <Button subtle title="تسجيل الخروج" onPress={signOut} />
        <Button
          subtle
          title="حذف حسابي"
          onPress={() => go({ name: 'delete-account' })}
        />
      </Card>
    </View>
  );
}
export function AccountForm({ kind }: { kind: string }) {
  const { me, reloadMe, back, signOut } = useApp();
  const organization = isOrganization(me);
  if (kind === 'security') return <SecuritySettings />;
  if (kind === 'specialties')
    return (
      <Resource<{
        data: { id: number; name: string }[];
      }> path="/users/me/specialties">
        {(r) => (
          <Card>
            <Title>مجالات تخصصي</Title>
            <Form
              fields={[field('names', 'التخصصات (كل تخصص في سطر)', 'strings')]}
              initial={{ names: r.data.map((x) => x.name).join('\n') }}
              submit={(v) =>
                api('/users/me/specialties', 'PUT', { names: v.names ?? [] })
              }
            />
          </Card>
        )}
      </Resource>
    );
  if (kind === 'delete-account')
    return (
      <Card>
        <Title>حذف الحساب</Title>
        <Txt>سيُحذف حسابك وبياناته وفق سياسة المنصة. هذا الإجراء نهائي.</Txt>
        <DeleteAccount />
      </Card>
    );
  return (
    <Card>
      <Title>{kind === 'privacy' ? 'الخصوصية' : 'ملفي الشخصي'}</Title>
      {kind === 'privacy' && (
        <Txt>
          يطبّق الخادم قواعد الخصوصية والعمر على المعلومات الظاهرة للآخرين.
        </Txt>
      )}
      <Form
        fields={
          kind === 'privacy'
            ? organization
              ? privacyFields.filter((item) =>
                  [
                    'showAddress',
                    ...(me.verifiedKind
                      ? ['acceptsPublishRequests', 'hideRating']
                      : []),
                  ].includes(item.key),
                )
              : privacyFields
            : organization
              ? profileFields
                  .filter((item) =>
                    [
                      'name',
                      'bio',
                      'governorate',
                      'city',
                      'neighborhood',
                    ].includes(item.key),
                  )
                  .map((item) =>
                    item.key === 'bio'
                      ? { ...item, label: 'نبذة عن الجمعية' }
                      : item,
                  )
              : profileFields
        }
        initial={{ ...me }}
        submit={async (v) => {
          await api(
            `/users/me/${kind === 'privacy' ? 'privacy' : 'profile'}`,
            'PATCH',
            v,
          );
          await reloadMe();
        }}
      />
    </Card>
  );
}

function MyOrganizationStats({ userId }: { userId: number }) {
  return (
    <Resource<OrganizerStats> path={`/users/${userId}/organizer-stats`}>
      {(stats) => (
        <Card>
          <Title>أثرنا بالأرقام</Title>
          <Row>
            <Txt>{stats.completedEvents} فعالية مكتملة</Txt>
            <Txt>{stats.acceptedVolunteers} متطوع شارك معنا</Txt>
          </Row>
          <Txt>
            {stats.rating.hidden
              ? 'التقييم مخفي عن الناس'
              : stats.rating.enoughRatings
                ? `★ ${stats.rating.average} · ${stats.rating.count} تقييم`
                : 'يظهر التقييم بعد 3 تقييمات'}
          </Txt>
          {stats.impact.map((item) => (
            <Txt key={item.label}>
              {item.total} {item.label}
            </Txt>
          ))}
        </Card>
      )}
    </Resource>
  );
}
function DeleteAccount() {
  const { signOut } = useApp();
  const [password, setPassword] = useState<Values>({});
  return (
    <>
      <Fields
        fields={[field('password', 'أدخل كلمة المرور', 'password', true)]}
        values={password}
        change={setPassword}
      />
      <Confirm
        title="حذف حسابي نهائياً"
        action={async () => {
          if (!password.password) throw new Error('أدخل كلمة المرور');
          await api('/users/me', 'DELETE', password);
          await signOut();
        }}
      />
    </>
  );
}
export function InterestsScreen() {
  return (
    <Resource<Interests> path="/users/me/interests">
      {(interests) => <InterestsEditor initial={interests} />}
    </Resource>
  );
}
function InterestsEditor({ initial }: { initial: Interests }) {
  const { sections, reloadMe, back } = useApp();
  const [v, setV] = useState<Values>({ ...initial });
  const chosen = sections.filter((s) =>
    (v.sectionIds as number[]).includes(s.id),
  );
  const fields = [
    {
      key: 'sectionIds',
      label: 'المجالات التي تعنيك',
      kind: 'multi' as const,
      required: true,
      options: sections.map((s) => ({ value: s.id, label: s.nameAr })),
    },
    {
      key: 'topicIds',
      label: 'مواضيع تتابعها',
      kind: 'multi' as const,
      required: true,
      options: chosen.flatMap((s) =>
        s.topics.map((t) => ({
          value: t.id,
          label: `${s.nameAr} · ${t.nameAr}`,
        })),
      ),
    },
    select(
      'primarySectionId',
      'مجالك الأساسي',
      chosen.map((s) => ({ value: s.id, label: s.nameAr })),
    ),
  ];
  return (
    <Card>
      <Title>خلّي واثق أقرب لاهتماماتك</Title>
      <Txt>اختر مجالاً وموضوعاً على الأقل.</Txt>
      <Fields
        fields={fields}
        values={v}
        change={(next) => {
          const ids = next.sectionIds as number[];
          const topics = new Set(
            sections
              .filter((s) => ids.includes(s.id))
              .flatMap((s) => s.topics.map((t) => t.id)),
          );
          next.topicIds = (next.topicIds as number[]).filter((id) =>
            topics.has(id),
          );
          if (!ids.includes(next.primarySectionId as number))
            next.primarySectionId = undefined;
          setV(next);
        }}
      />
      <Button
        title="حفظ الاهتمامات"
        onPress={async () => {
          await api('/users/me/interests', 'PUT', {
            ...encode(fields, v),
            primarySectionId: v.primarySectionId ?? null,
          });
          await api('/users/me/onboarding/complete', 'POST');
          await reloadMe();
          back();
        }}
      />
    </Card>
  );
}
export function UserProfile({ id }: { id: number }) {
  const { me, go } = useApp();
  const [tab, setTab] = useState('about');
  return (
    <Resource<PublicProfileView> path={`/users/${id}`}>
      {(p) => (
        <View style={{ gap: 16 }}>
          <Card>
            <Person person={p} />
            <Txt style={{ fontSize: 12 }}>رقم الحساب: {p.id}</Txt>
            <Txt>{p.bio}</Txt>
            {p.age !== null && <Txt>العمر: {p.age}</Txt>}
            {p.address && (
              <Txt>
                {
                  governorates.find((g) => g.value === p.address?.governorate)
                    ?.label
                }{' '}
                · {p.address.city} · {p.address.neighborhood}
              </Txt>
            )}
            {p.education && (
              <Txt>
                {education.find((e) => e.value === p.education?.level)?.label} ·{' '}
                {p.education.fieldOfStudy}
              </Txt>
            )}
            {p.workField && <Txt>{p.workField}</Txt>}
            {p.foundedYear && <Txt>تأسست عام {p.foundedYear}</Txt>}
            <Row>
              {p.specialties.map((s) => (
                <Txt key={s.id}>{s.name}</Txt>
              ))}
            </Row>
            {/* A frozen organization only browses: follow, requests and reports wait. */}
            {p.verifiedKind && p.id !== me.id && !me.pendingOrganization && (
              <>
                <Follow id={id} />
                {!me.verifiedKind && (
                  <Button
                    title="اطلب منه النشر"
                    onPress={() => go({ name: 'compose', targetId: id })}
                  />
                )}
                {/* Organizations do not join teams (the API refuses with 403). */}
                {!isOrganization(me) && (
                  <Button
                    subtle
                    title="طلب الانضمام للفريق"
                    onPress={() => go({ name: 'join-team', id })}
                  />
                )}
              </>
            )}
            {p.id !== me.id && !me.pendingOrganization && (
              <Button
                subtle
                title="الإبلاغ عن الحساب"
                onPress={() => go({ name: 'report', kind: 'USER', id })}
              />
            )}
          </Card>
          <Row>
            {[
              ['about', 'الأثر'],
              ['posts', 'المنشورات'],
              ['teams', 'الفرق'],
              ['badges', 'الشارات'],
              ...(p.verifiedKind
                ? [
                    ['members', 'الأعضاء'],
                    ['followers', 'المتابعون'],
                  ]
                : []),
            ].map(([value, label]) => (
              <Chip
                key={value}
                title={label}
                active={tab === value}
                onPress={() => setTab(value)}
              />
            ))}
          </Row>
          {tab === 'about' &&
            (p.verifiedKind ? (
              <Resource<OrganizerStats> path={`/users/${id}/organizer-stats`}>
                {(s) => (
                  <Card>
                    <Title>أثرنا بالأرقام</Title>
                    <HighlightBadge count={s.weeklyHighlights} />
                    <Txt>
                      {s.completedEvents} فعالية مكتملة · {s.acceptedVolunteers}{' '}
                      متطوع
                    </Txt>
                    {s.impact.map((i, n) => (
                      <Txt key={n}>
                        {i.total} {i.label}
                      </Txt>
                    ))}
                    {!s.rating.hidden && (
                      <Txt>
                        {s.rating.enoughRatings
                          ? `★ ${s.rating.average} · ${s.rating.count} تقييم`
                          : 'لا توجد تقييمات كافية للعرض بعد.'}
                      </Txt>
                    )}
                  </Card>
                )}
              </Resource>
            ) : (
              <Txt>تعرّف على مشاركاته وشاراته وفرق العمل من الأقسام أعلاه.</Txt>
            ))}
          {tab === 'posts' && <Feed authorId={id} />}
          {tab === 'badges' && <Badges userId={id} />}
          {tab === 'followers' && (
            <PeopleList path={`/users/${id}/followers`} />
          )}
          {tab === 'teams' && (
            <List<ProfileTeam>
              path={`/users/${id}/teams`}
              render={(t) => (
                <Card>
                  <Person person={t.team} />
                  <Txt>
                    {t.role} · {t.startYear ?? '—'} — {t.endYear ?? 'الآن'}
                  </Txt>
                </Card>
              )}
            />
          )}
          {tab === 'members' && (
            <List<{ id: number; user: UserCard; role: string }>
              path={`/users/${id}/members`}
              render={(t) => (
                <Card>
                  <Person person={t.user} />
                  <Txt>{t.role}</Txt>
                </Card>
              )}
            />
          )}
        </View>
      )}
    </Resource>
  );
}
function Follow({ id }: { id: number }) {
  // The API has no per-profile follow flag. Walk all pages before deciding the action.
  const [following, setFollowing] = useState<boolean>();
  const [error, setError] = useState('');
  const load = async () => {
    try {
      let page = 1;
      let found = false;
      for (;;) {
        const r = await api<Paginated<UserCard>>(
          `/users/me/following?page=${page}&limit=100`,
        );
        if (r.data.some((u) => u.id === id)) {
          found = true;
          break;
        }
        if (page >= r.meta.totalPages) break;
        page++;
      }
      setFollowing(found);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الاتصال');
    }
  };
  React.useEffect(() => {
    void load();
  }, [id]);
  return (
    <>
      {error ? (
        <>
          <Txt>{error}</Txt>
          <Button subtle title="إعادة تحميل المتابعة" onPress={load} />
        </>
      ) : (
        <Button
          title={
            following
              ? 'إلغاء المتابعة'
              : following === undefined
                ? 'تحميل المتابعة…'
                : 'متابعة الحساب'
          }
          disabled={following === undefined}
          onPress={async () => {
            await api(`/users/${id}/follow`, following ? 'DELETE' : 'POST');
            setFollowing(!following);
          }}
        />
      )}
    </>
  );
}
export function PeopleList({ path }: { path: string }) {
  return (
    <List<UserCard>
      path={path}
      render={(p) => (
        <Card>
          <Person person={p} />
        </Card>
      )}
    />
  );
}
export function ReceivedRatings() {
  const { go } = useApp();
  return (
    <>
      <Title>تقييمات المشاركين</Title>
      <List<{
        id: number;
        stars: number;
        rater: UserCard;
        event: { id: number; title: string };
        updatedAt: string;
      }>
        path="/ratings/received"
        render={(r) => (
          <Card>
            <Person person={r.rater} />
            <Txt>{'★'.repeat(r.stars)}</Txt>
            <Txt>{r.event.title}</Txt>
            <Txt>{dateText(r.updatedAt)}</Txt>
            <Button
              subtle
              title="عرض الفعالية"
              onPress={() =>
                go({ name: 'post', id: r.event.id, kind: 'EVENT' })
              }
            />
          </Card>
        )}
      />
    </>
  );
}
export function Applications() {
  const { go } = useApp();
  return (
    <>
      <Title>طلبات التطوع</Title>
      <List<
        ApplicationView & {
          event: { id: number; title: string; startsAt: string };
        }
      >
        path="/event-applications/me"
        render={(a, reload) => (
          <Card>
            <Title>{a.event.title}</Title>
            <Txt>
              {statusText[a.status]} · {a.role?.name}
            </Txt>
            <Txt>{dateText(a.event.startsAt)}</Txt>
            <Button
              title="عرض الفعالية"
              onPress={() => go({ name: 'post', id: a.eventId, kind: 'EVENT' })}
            />
            {['PENDING', 'ACCEPTED'].includes(a.status) && (
              <Confirm
                title="سحب الطلب"
                action={async () => {
                  await api(`/event-applications/${a.id}/withdraw`, 'POST');
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
export function Badges({ userId }: { userId?: number }) {
  return (
    <List<BadgeView>
      path={userId ? `/badges/user/${userId}` : '/badges/me'}
      render={(b, reload) => (
        <Card>
          <Title>{b.event.title}</Title>
          <Txt>
            {b.kind === 'CERTIFICATE' ? 'شهادة' : 'شارة'} ·{' '}
            {statusText[b.status]}
          </Txt>
          {b.imageUrl && <Photo uri={b.imageUrl} />}
          <Txt>{b.description}</Txt>
          <Txt>{b.role?.name}</Txt>
          <Person person={b.event.organizer} />
          {!userId && b.status === 'APPROVED' && (
            <Button
              subtle
              title={b.isShownOnProfile ? 'إخفاء من الملف' : 'إظهار في الملف'}
              onPress={async () => {
                await api(`/badges/${b.id}`, 'PATCH', {
                  isShownOnProfile: !b.isShownOnProfile,
                });
                reload();
              }}
            />
          )}
        </Card>
      )}
    />
  );
}
const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export function Cv() {
  const c = useColors();
  const { go } = useApp();
  const [qrBadge, setQrBadge] = useState<number | null>(null);
  const [share, setShare] = useState<{
    enabled: boolean;
    token: string | null;
    offline: string | null;
  } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  React.useEffect(() => {
    void api<typeof share>('/users/me/cv/share')
      .then(setShare)
      .catch(() => {});
  }, []);
  const shareUrl = share?.token
    ? `${process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3001'}/cv/share/${share.token}${share.offline ? `#o=${share.offline}` : ''}`
    : '';
  return (
    <Resource<VolunteerCv> path="/users/me/cv">
      {(cv) => (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Title>سيرتي التطوعية</Title>
              <Txt style={{ color: c.muted, fontSize: 12 }}>
                سجل إنجازاتك وأثرك في مجتمعك
              </Txt>
            </View>
            <Button subtle title="حسابي" onPress={() => go({ name: 'me' })} />
          </View>

          <Card>
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Txt
                  style={{ fontFamily: 'Cairo', fontSize: 23, lineHeight: 34 }}
                >
                  {cv.person.name}
                </Txt>
                <Txt style={{ color: c.primaryInk, fontFamily: 'TajawalBold' }}>
                  سيرة العمل التطوعي
                </Txt>
                {!!cv.person.city && (
                  <Txt style={{ color: c.muted, fontSize: 13 }}>
                    {[
                      cv.person.city,
                      cv.person.governorate
                        ? GOVERNORATE_LABELS_AR[cv.person.governorate]
                        : '',
                    ]
                      .filter(Boolean)
                      .join('، ')}
                  </Txt>
                )}
                {(cv.person.educationLevel || cv.person.fieldOfStudy) && (
                  <Txt style={{ color: c.muted, fontSize: 12 }}>
                    {[
                      cv.person.educationLevel
                        ? EDUCATION_LABELS_AR[cv.person.educationLevel]
                        : '',
                      cv.person.fieldOfStudy,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Txt>
                )}
                {!!cv.person.workField && (
                  <Txt style={{ color: c.muted, fontSize: 13 }}>
                    {cv.person.workField}
                  </Txt>
                )}
              </View>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.primaryDark,
                }}
              >
                <Txt
                  style={{ color: '#fff', fontFamily: 'Cairo', fontSize: 25 }}
                >
                  {cv.person.name.trim().charAt(0)}
                </Txt>
              </View>
            </View>
            {!!cv.person.bio && (
              <Txt style={{ lineHeight: 27 }}>{cv.person.bio}</Txt>
            )}
            <View
              style={{ height: 1, backgroundColor: c.line, marginVertical: 2 }}
            />
            <View style={{ flexDirection: 'row', gap: 7 }}>
              <CvStat
                value={cv.stats.volunteerHours}
                label="ساعة موثقة"
                color={c.primaryInk}
              />
              <CvStat
                value={cv.stats.approvedBadges}
                label="شارات موثقة"
                color="#B88730"
              />
              <CvStat
                value={cv.stats.completedEvents}
                label="فعاليات مكتملة"
                color="#168266"
              />
            </View>
            <Txt style={{ color: c.muted, fontSize: 10 }}>
              الساعات محسوبة من مدد الفعاليات التي اعتمد المنظّم شاراتها.
            </Txt>
            <Txt style={{ color: c.muted, fontSize: 11 }}>
              صادرة في {dateText(cv.generatedAt)}
            </Txt>
          </Card>

          <Card>
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 13,
              }}
            >
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 15,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: c.line,
                }}
              >
                <QRCode
                  value={
                    shareUrl ||
                    `${process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3001'}/cv/share`
                  }
                  size={104}
                  color="#13263A"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1, gap: 3, alignItems: 'flex-end' }}>
                <Txt style={{ fontFamily: 'TajawalBold', color: c.ink }}>
                  {share?.enabled
                    ? 'رابط QR للسيرة التطوعية'
                    : 'أنشئ رابط سيرتك'}
                </Txt>
                <Txt style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
                  {share?.enabled
                    ? 'افتح الرابط لعرض السيرة العامة والتحقق منها.'
                    : 'أنشئ رابطًا عامًا للسيرة ورمز QR.'}
                </Txt>
                <Txt
                  style={{
                    color: c.primaryInk,
                    fontSize: 11,
                    fontFamily: 'TajawalBold',
                  }}
                >
                  نسخة البيانات: {dateText(cv.generatedAt)}
                </Txt>
              </View>
            </View>
            <Button
              title={share?.enabled ? 'إنشاء رابط جديد' : 'إنشاء رابط ورمز QR'}
              disabled={shareBusy}
              onPress={async () => {
                setShareBusy(true);
                try {
                  setShare(await api('/users/me/cv/share', 'POST'));
                } finally {
                  setShareBusy(false);
                }
              }}
            />
            {share?.enabled && (
              <Button
                subtle
                title="إيقاف مشاركة السيرة"
                onPress={async () => {
                  await api('/users/me/cv/share', 'DELETE');
                  setShare({ enabled: false, token: null, offline: null });
                }}
              />
            )}
            <View
              style={{ backgroundColor: c.icy, padding: 10, borderRadius: 15 }}
            >
              <Txt style={{ color: c.muted, fontSize: 11 }}>
                المحتوى دون اتصال نسخة للعرض؛ تحقق أصالة الشارات من شاشة «تحقق
                QR» عند توفر الإنترنت.
              </Txt>
            </View>
            <Button
              title="تصدير ومشاركة PDF"
              onPress={async () => {
                const uri = new FileSystem.File(
                  FileSystem.Paths.cache,
                  `wathiq-cv-${cv.person.id}.pdf`,
                ).uri;
                await downloadAuthenticated('/users/me/cv/pdf', uri);
                if (await Sharing.isAvailableAsync())
                  await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    UTI: 'com.adobe.pdf',
                  });
                else throw new Error('المشاركة غير متاحة على هذا الجهاز.');
              }}
            />
          </Card>

          <View style={{ gap: 9 }}>
            <Title>المشاركات التطوعية</Title>
            {cv.badges.length === 0 ? (
              <Card>
                <Txt style={{ color: c.muted }}>لا توجد شارات ممنوحة بعد.</Txt>
              </Card>
            ) : (
              cv.badges.map((b) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`عرض توثيق فعالية ${b.event.title}`}
                  onPress={() =>
                    go({ name: 'post', id: b.event.id, kind: 'EVENT' })
                  }
                >
                  <Card>
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: c.icy,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Txt style={{ fontSize: 22 }}>
                          {b.kind === 'CERTIFICATE' ? '✦' : '🏅'}
                        </Txt>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Txt
                          style={{ fontFamily: 'TajawalBold', fontSize: 17 }}
                        >
                          {b.event.title}
                        </Txt>
                        <Txt style={{ color: c.muted, fontSize: 12 }}>
                          {b.event.organizer.name} · {b.event.section.nameAr}
                          {b.role ? ` · ${b.role}` : ''}
                        </Txt>
                        <Txt style={{ color: c.muted, fontSize: 12 }}>
                          {dateText(b.event.startsAt)}
                          {b.kind === 'CERTIFICATE'
                            ? ' · شهادة حضور'
                            : ' · شارة معتمدة'}
                        </Txt>
                      </View>
                    </View>
                    {!!b.description && (
                      <Txt style={{ color: c.inkSoft, fontSize: 13 }}>
                        «{b.description}»
                      </Txt>
                    )}
                    <Button
                      subtle
                      title={
                        qrBadge === b.id
                          ? 'إخفاء رمز التحقق'
                          : 'عرض رمز تحقق الشارة'
                      }
                      onPress={() => setQrBadge(qrBadge === b.id ? null : b.id)}
                    />
                    {qrBadge === b.id && (
                      <View
                        style={{
                          alignItems: 'center',
                          gap: 7,
                          padding: 12,
                          borderRadius: 18,
                          backgroundColor: c.icy,
                        }}
                      >
                        <QRCode
                          value={`wathiq://badge/${b.id}`}
                          size={156}
                          color="#13263A"
                          backgroundColor="#FFFFFF"
                        />
                        <Txt
                          style={{
                            color: c.primaryInk,
                            fontSize: 12,
                            fontFamily: 'TajawalBold',
                          }}
                        >
                          CSH-{b.id} · امسح للتحقق عبر الإنترنت
                        </Txt>
                      </View>
                    )}
                  </Card>
                </Pressable>
              ))
            )}
          </View>

          {!!cv.impact.length && (
            <Card>
              <Title>أثر الفعاليات</Title>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'center',
                }}
              >
                {cv.impact.map((metric) => (
                  <CvStat
                    key={metric.label}
                    value={metric.total}
                    label={metric.label}
                    color={c.primaryInk}
                  />
                ))}
              </View>
            </Card>
          )}

          {!!cv.teams.length && (
            <Card>
              <Title>الفرق</Title>
              {cv.teams.map((team) => (
                <View
                  key={team.id}
                  style={{
                    flexDirection: 'row-reverse',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: c.line,
                    paddingVertical: 7,
                  }}
                >
                  <Txt
                    style={{
                      fontFamily: 'TajawalBold',
                      flex: 1,
                      textAlign: 'right',
                    }}
                  >
                    {team.team.name}
                    {team.role ? ` · ${team.role}` : ''}
                  </Txt>
                  <Txt style={{ color: c.muted, fontSize: 12 }}>
                    {team.startYear
                      ? `${team.startYear} – ${team.endYear ?? 'حتى الآن'}`
                      : ''}
                  </Txt>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </Resource>
  );
}

function CvStat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 80,
        padding: 10,
        borderRadius: 17,
        backgroundColor: c.icy,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt
        style={{
          fontSize: 22,
          lineHeight: 28,
          fontFamily: 'TajawalBold',
          color,
        }}
      >
        {value}
      </Txt>
      <Txt style={{ fontSize: 11, lineHeight: 18, color: c.muted }}>
        {label}
      </Txt>
    </View>
  );
}
export function Search() {
  const { me, sections } = useApp();
  const regions = useResource<{
    data: {
      governorate: keyof typeof GOVERNORATE_LABELS_AR;
      cities: { city: string }[];
    }[];
  }>('/search/accounts/regions');
  const [draft, setDraft] = useState<Values>({});
  const [kind, setKind] = useState('accounts');
  const [filters, setFilters] = useState<Values>({});
  return (
    <View style={{ gap: 16 }}>
      <Title>ناس تجمعنا، وأثر يجمعهم</Title>
      <Row>
        <Chip
          title="المنظمات والفرق"
          active={kind === 'accounts'}
          onPress={() => {
            setKind('accounts');
            setFilters({});
            setDraft({});
          }}
        />
        {me.verifiedKind && (
          <Chip
            title="المتطوعون"
            active={kind === 'people'}
            onPress={() => {
              setKind('people');
              setFilters({});
              setDraft({});
            }}
          />
        )}
      </Row>
      <Card>
        <Resource<
          Paginated<{ id: number; name: string }>
        > path="/specialties?limit=100">
          {(specialties) => (
            <>
              <Fields
                values={draft}
                change={(next) => {
                  if (next.governorate !== draft.governorate)
                    next.city = undefined;
                  setDraft(next);
                }}
                fields={[
                  field('q', 'ابحث بالاسم'),
                  select(
                    'governorate',
                    'المحافظة',
                    kind === 'accounts'
                      ? (regions.data?.data ?? []).map((r) => ({
                          value: r.governorate,
                          label: GOVERNORATE_LABELS_AR[r.governorate],
                        }))
                      : governorates,
                  ),
                  kind === 'accounts'
                    ? select(
                        'city',
                        'المدينة',
                        (
                          regions.data?.data.find(
                            (r) => r.governorate === draft.governorate,
                          )?.cities ?? []
                        ).map((r) => ({ value: r.city, label: r.city })),
                      )
                    : field('city', 'المدينة'),
                  ...(kind === 'accounts'
                    ? [
                        select(
                          'specialtyId',
                          'التخصص',
                          specialties.data.map((s) => ({
                            value: s.id,
                            label: s.name,
                          })),
                        ),
                      ]
                    : [
                        select('educationLevel', 'التعليم', education),
                        field('fieldOfStudy', 'الدراسة'),
                        field('workField', 'العمل'),
                        select('hasVolunteered', 'سبق له التطوع', [
                          { value: 'true', label: 'نعم' },
                          { value: 'false', label: 'لا' },
                        ]),
                        sectionField(sections, false),
                        select(
                          'topicId',
                          'الموضوع',
                          sections.flatMap((s) =>
                            s.topics.map((t) => ({
                              value: t.id,
                              label: t.nameAr,
                            })),
                          ),
                        ),
                      ]),
                ]}
              />
              {kind === 'accounts' && regions.loading && (
                <Txt>جارٍ تحميل المناطق…</Txt>
              )}
              {kind === 'accounts' && regions.error && (
                <>
                  <Txt>{regions.error}</Txt>
                  <Button
                    subtle
                    title="إعادة تحميل المناطق"
                    onPress={regions.reload}
                  />
                </>
              )}
              <Button title="بحث" onPress={() => setFilters({ ...draft })} />
            </>
          )}
        </Resource>
      </Card>
      <List<
        UserCard & {
          bio?: string;
          region?: {
            governorate: keyof typeof GOVERNORATE_LABELS_AR;
            city?: string;
          };
          specialties?: { id: number; name: string }[];
          age?: number | null;
          address?: { city?: string } | null;
          workField?: string | null;
          completedVolunteering?: number;
        }
      >
        path={`/search/${kind}?${query(filters)}`}
        render={(p) => (
          <Card>
            <Person person={p} />
            <Txt style={{ fontSize: 12 }}>رقم الحساب: {p.id}</Txt>
            {!!p.bio && <Txt>{p.bio}</Txt>}
            {p.specialties ? (
              <>
                <Txt>
                  {p.verifiedKind === 'ORGANIZATION'
                    ? 'منظمة موثّقة'
                    : 'حساب موثّق'}
                </Txt>
                {p.region && (
                  <Txt>
                    {p.region.city ||
                      GOVERNORATE_LABELS_AR[p.region.governorate]}
                  </Txt>
                )}
                <Row>
                  {p.specialties.map((s) => (
                    <Txt key={s.id}>{s.name}</Txt>
                  ))}
                </Row>
              </>
            ) : (
              <Txt>
                {[
                  p.age != null ? `${p.age} سنة` : null,
                  p.address?.city,
                  p.workField,
                  p.completedVolunteering
                    ? `${p.completedVolunteering} مشاركة تطوعية`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'معلوماته مخفية'}
              </Txt>
            )}
          </Card>
        )}
      />
    </View>
  );
}

function SecuritySettings() {
  const { me, signOut } = useApp();
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <Card>
      <Title>الحساب وكلمة المرور</Title>
      <Txt>{me.email || 'البريد الإلكتروني غير مضاف'}</Txt>
      <Txt>{me.phone || 'رقم الهاتف غير مضاف'}</Txt>
      {!reset ? (
        <Form
          key={revision}
          fields={[
            field('currentPassword', 'كلمة المرور الحالية', 'password', true),
            field('newPassword', 'كلمة المرور الجديدة', 'password', true),
            field(
              'confirmPassword',
              'تأكيد كلمة المرور الجديدة',
              'password',
              true,
            ),
          ]}
          title="تغيير كلمة المرور"
          submit={async (v) => {
            if (v.newPassword !== v.confirmPassword)
              throw new Error('كلمتا المرور غير متطابقتين');
            if (String(v.newPassword).length < 8)
              throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            const tokens = await api<AuthTokens>(
              '/auth/password/change',
              'POST',
              {
                currentPassword: v.currentPassword,
                newPassword: v.newPassword,
                deviceInfo: 'mobile',
              },
            );
            await setSession(tokens);
            setRevision((x) => x + 1);
            Alert.alert('تم', 'تغيّرت كلمة المرور بنجاح');
          }}
        />
      ) : !sent ? (
        <Form
          fields={[]}
          title="أرسل الرمز إلى بريدي"
          submit={async () => {
            if (!me.email) throw new Error('لا يوجد بريد إلكتروني للحساب');
            await api('/auth/password/forgot', 'POST', {
              identifier: me.email,
            });
            setSent(true);
          }}
        />
      ) : (
        <Form
          fields={[
            field('code', 'رمز التحقق', 'text', true),
            field('newPassword', 'كلمة المرور الجديدة', 'password', true),
            field(
              'confirmPassword',
              'تأكيد كلمة المرور الجديدة',
              'password',
              true,
            ),
          ]}
          title="استعادة كلمة المرور"
          submit={async (v) => {
            if (v.newPassword !== v.confirmPassword)
              throw new Error('كلمتا المرور غير متطابقتين');
            // Remove this device before the reset revokes every session token.
            await unregisterPush();
            await api('/auth/password/reset', 'POST', {
              identifier: me.email,
              code: v.code,
              newPassword: v.newPassword,
            });
            await signOut();
          }}
        />
      )}
      <Button
        subtle
        title={reset ? 'تغيير بكلمة المرور الحالية' : 'نسيت كلمة المرور'}
        onPress={() => setReset(!reset)}
      />
    </Card>
  );
}

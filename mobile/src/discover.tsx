// Screens the web had and the app did not: the organization of the week (home card and honour
// board), the directory of verified accounts, and an organization's statistics of its own
// campaigns. Same API and shared types as the web (packages/shared).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  EDUCATION_LABELS_AR,
  GOVERNORATE_LABELS_AR,
  SECTION_COLORS,
  newVolunteersWordAr,
  type EducationLevel,
  type Governorate,
  type Paginated,
  type StatsPeriod,
  type StatsReport,
  type WeeklyHighlight,
} from '@csh/shared';
import { downloadAuthenticated } from './api';
import { List, Resource, useApp, useResource } from './state';
import { Button, Card, Chip, Row, Title, Txt, useColors } from './ui';

type Winner = WeeklyHighlight & {
  organizer: NonNullable<WeeklyHighlight['organizer']>;
};

const gov = (g: string | null | undefined) =>
  g ? (GOVERNORATE_LABELS_AR[g as Governorate] ?? g) : '';
const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-SY', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Damascus',
  });
/** "14 – 20 تشرين الثاني": Saturday to Friday (weekEnd is the next Saturday). */
const weekRange = (h: Pick<WeeklyHighlight, 'weekStart' | 'weekEnd'>) =>
  `${dayMonth(h.weekStart)} – ${dayMonth(
    new Date(new Date(h.weekEnd).getTime() - 24 * 60 * 60 * 1000).toISOString(),
  )}`;
const num = (n: number) => new Intl.NumberFormat('en-US').format(n);
const right = { textAlign: 'right' as const };

// ── Organization of the week ───────────────────────────────────────────────

/**
 * The organization of the week at the top of home: the account that brought the most
 * first-time volunteers in the last finished week. Nothing shows while no week has a winner.
 */
export function WeeklyHighlightCard() {
  const { go } = useApp();
  const { data } = useResource<WeeklyHighlight>('/highlights/current');
  if (!data?.organizer) return null;
  const o = data.organizer;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`جمعية الأسبوع: ${o.name}`}
      onPress={() => go({ name: 'user', id: o.id })}
    >
      <LinearGradient
        colors={['#13263A', '#1E3A56']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderRadius: 26, padding: 18, gap: 10 }}
      >
        <View
          style={{
            alignSelf: 'center',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Txt
            style={{ color: '#fff', fontSize: 12, fontFamily: 'TajawalBold' }}
          >
            ⭐ جمعية الأسبوع · {weekRange(data)}
          </Txt>
        </View>
        <Txt
          style={{
            color: '#fff',
            fontFamily: 'Cairo',
            fontSize: 22,
            lineHeight: 34,
          }}
        >
          {o.name}
        </Txt>
        {o.city || o.governorate ? (
          <Txt style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            {[o.city, gov(o.governorate)].filter(Boolean).join('، ')}
          </Txt>
        ) : null}
        <Txt
          style={{
            color: '#fff',
            fontFamily: 'Cairo',
            fontSize: 34,
            lineHeight: 44,
          }}
        >
          {data.newVolunteers}
        </Txt>
        <Txt
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            marginTop: -8,
          }}
        >
          {newVolunteersWordAr(data.newVolunteers)} استقبلتهم
        </Txt>
        <Pressable
          accessibilityRole="link"
          onPress={() => go({ name: 'highlights' })}
          style={{ alignSelf: 'center', padding: 4 }}
        >
          <Txt
            style={{ color: '#fff', fontSize: 13, fontFamily: 'TajawalBold' }}
          >
            لوحة الشرف ←
          </Txt>
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}

/** Honour board: every organization of the week, newest first. */
export function HonourBoard() {
  const { go } = useApp();
  const c = useColors();
  const [page, setPage] = useState(1);
  return (
    <View style={{ gap: 14 }}>
      <Title>لوحة الشرف: جمعية الأسبوع</Title>
      <Txt style={{ color: c.muted, fontSize: 13 }}>
        كل سبت نختار الجهة التي استقبلت أكبر عدد من المتطوعين لأول مرة، في
        فعاليات اكتملت ووُثّقت خلال الأسبوع. نحتاج 5 متطوعين جدد على الأقل.
      </Txt>
      <Resource<Paginated<Winner>>
        key={page}
        path={`/highlights?page=${page}&limit=20`}
      >
        {(res) => (
          <View>
            {!res.data.length && (
              <Card>
                <Txt>لم تُعلن جمعية الأسبوع بعد.</Txt>
              </Card>
            )}
            {res.data.map((h) => (
              <Pressable
                key={h.weekStart}
                accessibilityRole="button"
                onPress={() => go({ name: 'user', id: h.organizer.id })}
              >
                <Card>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ ...right, fontFamily: 'TajawalBold' }}>
                        {h.organizer.name}
                      </Txt>
                      <Txt style={{ ...right, color: c.muted, fontSize: 12 }}>
                        {weekRange(h)}
                      </Txt>
                    </View>
                    <View>
                      <Txt
                        style={{
                          fontFamily: 'Cairo',
                          fontSize: 22,
                          color: c.primaryInk,
                        }}
                      >
                        {h.newVolunteers}
                      </Txt>
                      <Txt style={{ fontSize: 11, color: c.muted }}>
                        {newVolunteersWordAr(h.newVolunteers)}
                      </Txt>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            ))}
            {res.meta.totalPages > 1 && (
              <Row>
                <Button
                  subtle
                  title="الأحدث"
                  disabled={page <= 1}
                  onPress={() => setPage((p) => p - 1)}
                />
                <Txt>
                  {page} / {res.meta.totalPages}
                </Txt>
                <Button
                  subtle
                  title="الأقدم"
                  disabled={page >= res.meta.totalPages}
                  onPress={() => setPage((p) => p + 1)}
                />
              </Row>
            )}
          </View>
        )}
      </Resource>
    </View>
  );
}

/** "⭐ جمعية الأسبوع × N" on a profile (from organizer-stats.weeklyHighlights). */
export function HighlightBadge({ count }: { count: number }) {
  const { go } = useApp();
  if (!count) return null;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => go({ name: 'highlights' })}
      style={{
        alignSelf: 'center',
        backgroundColor: '#FFF4DC',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Txt
        style={{ color: '#8D6B25', fontSize: 13, fontFamily: 'TajawalBold' }}
      >
        ⭐ جمعية الأسبوع{count > 1 ? ` × ${count}` : ''}
      </Txt>
    </Pressable>
  );
}

// ── Directory of verified accounts ─────────────────────────────────────────

interface DirectoryItem {
  id: number;
  name: string;
  verifiedKind: string | null;
  isPartner: boolean;
  bio: string;
  region: { governorate: string; city: string } | null;
  specialties: { id: number; name: string }[];
  completedEvents: number;
  rating: { hidden: boolean; average: number | null; count: number | null };
}

/** Every verified account (organizations and individuals), filtered by section. */
export function Directory() {
  const { sections, go } = useApp();
  const c = useColors();
  const [sectionId, setSectionId] = useState<number>();
  return (
    <View style={{ gap: 14 }}>
      <Title>الجمعيات والحسابات الموثّقة</Title>
      <Row>
        <Chip
          title="الكل"
          active={!sectionId}
          onPress={() => setSectionId(undefined)}
        />
        {sections.map((s) => (
          <Chip
            key={s.id}
            title={s.nameAr}
            active={sectionId === s.id}
            onPress={() => setSectionId(s.id)}
          />
        ))}
      </Row>
      <List<DirectoryItem>
        path={`/search/directory${sectionId ? `?sectionId=${sectionId}` : ''}`}
        render={(a) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => go({ name: 'user', id: a.id })}
          >
            <Card>
              <Txt
                style={{ ...right, fontFamily: 'TajawalBold', fontSize: 17 }}
              >
                {a.name} {a.verifiedKind ? '✓' : ''}
              </Txt>
              <Txt style={{ ...right, color: c.muted, fontSize: 12 }}>
                {[
                  a.verifiedKind === 'ORGANIZATION'
                    ? 'منظمة موثّقة'
                    : 'حساب موثّق',
                  a.isPartner ? 'شريك' : '',
                  a.region
                    ? [a.region.city, gov(a.region.governorate)]
                        .filter(Boolean)
                        .join('، ')
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
              {a.bio ? (
                <Txt numberOfLines={2} style={{ ...right, fontSize: 14 }}>
                  {a.bio}
                </Txt>
              ) : null}
              {a.specialties.length ? (
                <Txt style={{ ...right, color: c.primaryInk, fontSize: 12 }}>
                  {a.specialties.map((s) => s.name).join(' · ')}
                </Txt>
              ) : null}
              <Txt style={{ ...right, color: c.muted, fontSize: 12 }}>
                {a.completedEvents} فعالية مكتملة
                {a.rating.hidden
                  ? ' · التقييم مخفي'
                  : a.rating.average !== null
                    ? ` · ★ ${a.rating.average} (${a.rating.count})`
                    : ''}
              </Txt>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

// ── An organization's statistics ───────────────────────────────────────────

const PERIODS: [StatsPeriod, string][] = [
  ['30d', '30 يوماً'],
  ['90d', '3 أشهر'],
  ['365d', 'سنة'],
  ['all', 'الكل'],
];
const AGE_LABELS: Record<string, string> = {
  '13-17': 'من 13 إلى 17',
  '18-24': 'من 18 إلى 24',
  '25-34': 'من 25 إلى 34',
  '35+': '35 وأكثر',
  hidden: 'لم يُظهروا العمر',
};
const small = (n: number | null) => (n === null ? 'أقل من 5' : num(n));
const pct = (r: number | null) =>
  r === null ? '—' : `${Math.round(r * 100)}%`;

/** A horizontal bar row (scaled to the largest value of its list). */
function Bar({
  label,
  value,
  max,
  display,
  sub,
  color,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
  sub?: string;
  color: string;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 3 }}>
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
        }}
      >
        <Txt style={{ fontSize: 13, fontFamily: 'TajawalBold' }}>{label}</Txt>
        <Txt
          style={{
            fontSize: 13,
            color: c.primaryInk,
            fontFamily: 'TajawalBold',
          }}
        >
          {display ?? num(value)}
        </Txt>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: c.icy,
          flexDirection: 'row-reverse',
        }}
      >
        <View
          style={{
            width: `${Math.max(3, (value / Math.max(max, 1)) * 100)}%`,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>
      {sub ? (
        <Txt style={{ ...right, fontSize: 11, color: c.muted }}>{sub}</Txt>
      ) : null}
    </View>
  );
}

function Kpi({
  value,
  label,
  previous,
}: {
  value: number;
  label: string;
  previous?: number | null;
}) {
  const c = useColors();
  const change = previous
    ? Math.round(((value - previous) / previous) * 100)
    : null;
  return (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: c.icy,
        borderRadius: 18,
        padding: 12,
      }}
    >
      <Txt style={{ fontFamily: 'Cairo', fontSize: 26, lineHeight: 36 }}>
        {num(value)}
      </Txt>
      <Txt style={{ fontSize: 12, color: c.muted }}>{label}</Txt>
      {change !== null ? (
        <Txt
          style={{ fontSize: 11, color: change >= 0 ? '#2E7D4F' : '#B4433B' }}
        >
          {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% عن الفترة السابقة
        </Txt>
      ) : null}
    </View>
  );
}

/** A verified account's statistics of its own campaigns (GET /users/me/stats). */
export function MyStats() {
  const { dark } = useApp();
  const c = useColors();
  const [period, setPeriod] = useState<StatsPeriod>('365d');
  const [exporting, setExporting] = useState(false);
  const sectionColor = (slug: string) =>
    SECTION_COLORS[slug as keyof typeof SECTION_COLORS]?.[
      dark ? 'dark' : 'light'
    ].base ?? c.primary;

  return (
    <View style={{ gap: 14 }}>
      <Title>إحصائيات حملاتنا</Title>
      <Txt style={{ color: c.muted, fontSize: 13 }}>
        أرقام حملاتكم فقط. العمر والتحصيل يظهران لمن اختار إظهارهما، والفئات
        الأقل من 5 لا تُعرض.
      </Txt>
      <Row>
        {PERIODS.map(([key, label]) => (
          <Chip
            key={key}
            title={label}
            active={period === key}
            onPress={() => setPeriod(key)}
          />
        ))}
      </Row>
      <Resource<StatsReport>
        key={period}
        path={`/users/me/stats?period=${period}`}
      >
        {(r) => {
          const months = r.byMonth.slice(-12);
          const maxMonth = Math.max(...months.map((m) => m.campaigns), 1);
          const demanded = [...r.byTopic]
            .filter((t) => t.applicantsPerSeat !== null)
            .sort(
              (a, b) => (b.applicantsPerSeat ?? 0) - (a.applicantsPerSeat ?? 0),
            )
            .slice(0, 6);
          return (
            <View style={{ gap: 4 }}>
              <Card>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Kpi
                    value={r.totals.completed}
                    previous={r.previous?.completed}
                    label="حملة مكتملة"
                  />
                  <Kpi
                    value={r.totals.volunteers}
                    previous={r.previous?.volunteers}
                    label="متطوع شارك"
                  />
                  <Kpi
                    value={r.totals.volunteerHours}
                    previous={r.previous?.volunteerHours}
                    label="ساعة تطوع"
                  />
                  <Kpi
                    value={r.totals.newVolunteers}
                    previous={r.previous?.newVolunteers}
                    label="تطوّعوا لأول مرة معكم"
                  />
                </View>
                <Txt style={{ fontSize: 12, color: c.muted }}>
                  {r.totals.campaigns} حملة: {r.totals.completed} مكتملة،{' '}
                  {r.totals.upcoming} قادمة، {r.totals.cancelled} ملغاة.
                </Txt>
              </Card>

              <Card>
                <Title>الحملات المكتملة شهرياً</Title>
                {months.length ? (
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'flex-end',
                      height: 130,
                      gap: 4,
                    }}
                  >
                    {months.map((m) => (
                      <View
                        key={m.month}
                        style={{ flex: 1, alignItems: 'center', gap: 2 }}
                      >
                        <Txt style={{ fontSize: 10 }}>{m.campaigns || ''}</Txt>
                        <View
                          style={{
                            width: '80%',
                            height: Math.max(2, (m.campaigns / maxMonth) * 90),
                            backgroundColor: c.primary,
                            borderRadius: 4,
                            opacity: m.campaigns ? 0.8 : 0.25,
                          }}
                        />
                        <Txt style={{ fontSize: 9, color: c.muted }}>
                          {Number(m.month.slice(5))}
                        </Txt>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Txt style={{ color: c.muted }}>
                    لا توجد حملات مكتملة في هذه الفترة.
                  </Txt>
                )}
              </Card>

              <Card>
                <Title>وين في احتياج؟</Title>
                <Txt style={{ fontSize: 12, color: c.muted }}>
                  مقارنة كل محافظة بمعدل حملاتكم.
                </Txt>
                {r.byGovernorate.map((g) => (
                  <View
                    key={g.governorate}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                      paddingTop: 8,
                      gap: 2,
                    }}
                  >
                    <Txt style={{ ...right, fontFamily: 'TajawalBold' }}>
                      {gov(g.governorate)}
                      {g.signal === 'NEEDS_CAMPAIGNS'
                        ? '  🟠 يحتاج حملات'
                        : g.signal === 'NEEDS_VOLUNTEERS'
                          ? '  🔴 يحتاج متطوعين'
                          : ''}
                    </Txt>
                    <Txt style={{ ...right, fontSize: 12, color: c.muted }}>
                      {g.campaigns} حملة · {g.applicantsPerSeat ?? '—'} متقدم
                      لكل مقعد · امتلاء {pct(g.fillRate)} · {g.unfilledSeats}{' '}
                      مقعد فارغ
                    </Txt>
                  </View>
                ))}
              </Card>

              <Card>
                <Title>أكثر الحملات المطلوبة</Title>
                {demanded.length ? (
                  demanded.map((t) => (
                    <Bar
                      key={t.topicId}
                      label={t.nameAr}
                      value={t.applicantsPerSeat ?? 0}
                      max={demanded[0].applicantsPerSeat ?? 1}
                      display={`${t.applicantsPerSeat} لكل مقعد`}
                      sub={`${t.applicants} متقدم على ${t.seats} مقعد`}
                      color={sectionColor(t.sectionSlug)}
                    />
                  ))
                ) : (
                  <Txt style={{ color: c.muted }}>لا توجد بيانات بعد.</Txt>
                )}
              </Card>

              {r.impact.length ? (
                <Card>
                  <Title>الأثر</Title>
                  {r.impact.slice(0, 8).map((m) => (
                    <Bar
                      key={m.label}
                      label={m.label}
                      value={m.total}
                      max={r.impact[0].total}
                      color={c.primary}
                    />
                  ))}
                </Card>
              ) : null}

              <Card>
                <Title>المتطوعون</Title>
                <Row>
                  <Txt>{r.volunteers.firstTime} أول تجربة تطوع</Txt>
                  <Txt>{r.volunteers.returning} شاركوا أكثر من مرة</Txt>
                </Row>
                {r.volunteers.ageGroups.map((a) => (
                  <Txt key={a.group} style={{ fontSize: 13 }}>
                    {AGE_LABELS[a.group]}: {small(a.count)}
                  </Txt>
                ))}
                {r.volunteers.education.map((e) => (
                  <Txt key={e.level} style={{ fontSize: 13, color: c.muted }}>
                    {e.level === 'HIDDEN'
                      ? 'لم يُظهروا التحصيل'
                      : e.level === 'UNKNOWN'
                        ? 'تحصيل غير مذكور'
                        : (EDUCATION_LABELS_AR[e.level as EducationLevel] ??
                          e.level)}
                    : {small(e.count)}
                  </Txt>
                ))}
                <Txt style={{ fontSize: 13 }}>
                  {r.ratings.average !== null
                    ? `★ ${r.ratings.average} من ${r.ratings.count} تقييم`
                    : 'لا تقييمات بعد'}
                </Txt>
              </Card>

              <Button
                subtle
                title={exporting ? 'جارٍ تجهيز الملف…' : 'تصدير الحملات CSV'}
                disabled={exporting}
                onPress={async () => {
                  setExporting(true);
                  try {
                    const uri = `${FileSystem.Paths.cache}my-campaigns-${period}.csv`;
                    await downloadAuthenticated(
                      `/users/me/stats/campaigns.csv?period=${period}`,
                      uri,
                    );
                    if (await Sharing.isAvailableAsync())
                      await Sharing.shareAsync(uri, {
                        mimeType: 'text/csv',
                        UTI: 'public.comma-separated-values-text',
                      });
                    else throw new Error('المشاركة غير متاحة على هذا الجهاز.');
                  } finally {
                    setExporting(false);
                  }
                }}
              />
            </View>
          );
        }}
      </Resource>
    </View>
  );
}

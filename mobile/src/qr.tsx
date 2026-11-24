import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { toByteArray } from 'base64-js';
import { inflateRaw } from 'pako';
import nacl from 'tweetnacl';
import type { BadgeView, VolunteerCv } from '@csh/shared';
import { api, ApiError } from './api';
import { dateText } from './state';
import { Button, Card, Input, Title, Txt, useColors } from './ui';

export type OfflineVolunteerCv = {
  generatedAt: string;
  person: VolunteerCv['person'];
  stats: VolunteerCv['stats'];
  badges: {
    id: number;
    kind: 'BADGE' | 'CERTIFICATE';
    description: string;
    role: string | null;
    event: {
      id: number;
      title: string;
      startsAt: string;
      section: { nameAr: string };
      organizer: { name: string };
    };
  }[];
  teams: {
    id: number;
    role: string;
    startYear: number | null;
    endYear: number | null;
    team: { name: string };
  }[];
  impact: VolunteerCv['impact'];
  includedBadgeCount: number;
};

/** What a scanned CV link carries after `#o=`, checked against Wathiq's public key. */
type OfflineCheck =
  | { status: 'none' }
  | { status: 'no-key' }
  | { status: 'invalid' }
  | { status: 'ok'; cv: OfflineVolunteerCv };

/**
 * Reads the signed copy of a public CV from a scanned link (`<link>#o=<payload>.<signature>`).
 * The signature (Ed25519) is checked first: a changed copy is "invalid", never shown.
 */
function readOfflineCopy(value: string): OfflineCheck {
  const marker = value.includes('#o=') ? value.split('#o=')[1] : '';
  if (!marker) return { status: 'none' };
  if (!marker.includes('.') || marker.length > 5000)
    return { status: 'invalid' };
  const publicKey = process.env.EXPO_PUBLIC_CV_SIGNING_PUBLIC_KEY;
  if (!publicKey) return { status: 'no-key' };
  try {
    const [payload, signature] = marker.split('.');
    const decode = (v: string) =>
      toByteArray(
        v.replace(/-/g, '+').replace(/_/g, '/') +
          '==='.slice((v.length + 3) % 4),
      );
    const bytes = decode(payload),
      sig = decode(signature),
      key = decode(publicKey);
    if (!nacl.sign.detached.verify(bytes, sig, key))
      return { status: 'invalid' };
    // pako returns the text itself: no TextDecoder (not always there on Hermes).
    const parsed = JSON.parse(inflateRaw(bytes, { toText: true })) as any;
    if (!parsed.p?.n || !parsed.s || !Array.isArray(parsed.b))
      return { status: 'invalid' };
    return {
      status: 'ok',
      cv: {
        generatedAt: parsed.at,
        person: {
          id: 0,
          name: parsed.p.n,
          avatarUrl: '',
          bio: '',
          verifiedKind: 'INDIVIDUAL',
          governorate: parsed.p.g,
          city: parsed.p.c,
          educationLevel: parsed.p.e,
          fieldOfStudy: parsed.p.f,
          workField: parsed.p.w,
        },
        stats: {
          completedEvents: parsed.s.e,
          volunteerHours: parsed.s.h,
          approvedBadges: parsed.s.b,
        },
        badges: parsed.b.map((b: any, i: number) => ({
          id: i + 1,
          kind: b[5] === 'C' ? 'CERTIFICATE' : 'BADGE',
          description: '',
          role: b[4] || null,
          event: {
            id: i + 1,
            title: b[0],
            startsAt: b[1],
            section: { nameAr: b[3] },
            organizer: { name: b[2] },
          },
        })),
        teams: (parsed.m ?? []).map((m: any, i: number) => ({
          id: i + 1,
          role: m[1],
          startYear: m[2] || null,
          endYear: m[3] || null,
          team: { name: m[0] },
        })),
        impact: (parsed.i ?? []).map((i: any) => ({
          label: i[0],
          total: i[1],
        })),
        includedBadgeCount: parsed.n ?? parsed.b.length,
      },
    };
  } catch {
    return { status: 'invalid' };
  }
}

function badgeId(value: string) {
  const match =
    value.match(/^wathiq:\/\/badge\/(\d+)\/?$/i) ??
    value.match(/\/badges\/verify\/(\d+)\/?(?:\?.*)?$/i) ??
    value.match(/^(?:CSH-)?(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function ScanFrame({ onScan }: { onScan: (value: string) => void }) {
  const c = useColors();
  const beam = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(beam, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [beam]);
  return (
    <View
      style={{
        width: 240,
        height: 240,
        alignSelf: 'center',
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: c.primaryLight,
      }}
    >
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: 18,
          bottom: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.5)',
          borderRadius: 20,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          height: 3,
          top: 22,
          backgroundColor: c.primaryLight,
          shadowColor: c.primaryLight,
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
          transform: [
            {
              translateY: beam.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 190],
              }),
            },
          ],
        }}
      />
    </View>
  );
}

export function QrVerification() {
  const c = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cvResult, setCvResult] = useState<{
    cv: OfflineVolunteerCv;
    source: 'online' | 'offline';
  } | null>(null);
  const [badge, setBadge] = useState<BadgeView | null>(null);
  const [error, setError] = useState('');
  const locked = useRef(false);

  const processCode = async (value: string) => {
    if (locked.current) return;
    locked.current = true;
    setScanning(false);
    setError('');
    setBadge(null);
    setCvResult(null);
    const share = value.match(/\/cv\/share\/([^/#?]+)/);
    if (share || value.includes('#o=')) {
      // Online the link always shows the current CV; the signed copy in the code is only for
      // when there is no internet.
      setLoading(true);
      try {
        if (!share) throw new Error('offline only');
        const result = await api<VolunteerCv>(
          `/cv/public/${encodeURIComponent(share[1])}`,
          'GET',
          undefined,
          true,
        );
        setCvResult({
          cv: {
            ...result,
            includedBadgeCount: result.badges.length,
          } as unknown as OfflineVolunteerCv,
          source: 'online',
        });
        setCode('');
      } catch (e) {
        if (e instanceof ApiError) {
          // The server answered: the owner stopped sharing or made a new link.
          setError(
            e.status === 404
              ? 'هذا الرابط لم يعد يعمل: أوقف صاحب السيرة مشاركتها أو أنشأ رابطاً جديداً.'
              : 'تعذّر تحميل السيرة. حاول مجدداً.',
          );
        } else {
          const copy = readOfflineCopy(value);
          if (copy.status === 'ok') {
            setCvResult({ cv: copy.cv, source: 'offline' });
            setCode('');
          } else if (copy.status === 'invalid') {
            setError(
              'رمز غير موثوق: النسخة المحفوظة فيه معدّلة أو غير صادرة عن واثق.',
            );
          } else if (copy.status === 'no-key') {
            setError(
              'لا يمكن التحقق من النسخة دون اتصال في هذا الإصدار. اتصل بالإنترنت وأعد المسح.',
            );
          } else {
            setError(
              'لا يوجد اتصال بالإنترنت، وهذا الرمز لا يحمل نسخة للعرض دون اتصال.',
            );
          }
        }
      } finally {
        setLoading(false);
        locked.current = false;
      }
      return;
    }
    const id = badgeId(value.trim());
    if (!id || !Number.isSafeInteger(id) || id < 1) {
      setError('رمز QR غير معروف. امسح رمز سيرة واثق أو رمز شارة معتمدة.');
      locked.current = false;
      return;
    }
    setLoading(true);
    try {
      const result = await api<BadgeView>(
        `/badges/verify/${id}`,
        'GET',
        undefined,
        true,
      );
      setBadge(result);
      setCode('');
    } catch (e) {
      setError(
        e instanceof Error
          ? 'لم نعثر على شارة عامة معتمدة بهذا الرمز. تحقق من اتصال الإنترنت وحاول مجدداً.'
          : 'تعذّر التحقق من الرمز.',
      );
    } finally {
      setLoading(false);
      locked.current = false;
    }
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('يلزم السماح للكاميرا كي تمسح رمز QR.');
        return;
      }
    }
    setError('');
    setScanning(true);
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <View
          style={{
            alignSelf: 'center',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 18,
            backgroundColor: c.icy,
          }}
        >
          <Txt
            style={{
              color: c.primaryInk,
              fontSize: 12,
              fontFamily: 'TajawalBold',
            }}
          >
            ✓ تحقق عام دون تسجيل دخول
          </Txt>
        </View>
        <Title>التحقق من المشاركة بالشارة</Title>
        <Input label="رمز الشارة" value={code} onChange={setCode} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="تحقق الآن"
              onPress={() => processCode(code)}
              disabled={!code.trim() || loading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={scanning ? 'إيقاف المسح' : 'مسح QR'}
              subtle
              onPress={() => (scanning ? setScanning(false) : void startScan())}
            />
          </View>
        </View>
      </Card>

      {scanning && (
        <Card>
          <Txt style={{ color: c.primaryInk, fontFamily: 'TajawalBold' }}>
            وجّه الكاميرا نحو رمز QR
          </Txt>
          {!permission?.granted ? (
            <Button
              title="السماح باستخدام الكاميرا"
              onPress={() => void startScan()}
            />
          ) : (
            <ScanFrame onScan={(value) => void processCode(value)} />
          )}
        </Card>
      )}

      {loading && <ActivityIndicator color={c.primary} size="large" />}
      {!!error && (
        <Card>
          <Txt style={{ color: '#B84863' }}>{error}</Txt>
        </Card>
      )}
      {badge && <VerifiedBadge badge={badge} />}
      {cvResult && <OfflineCv cv={cvResult.cv} source={cvResult.source} />}
    </View>
  );
}

function VerifiedBadge({ badge }: { badge: BadgeView }) {
  const c = useColors();
  return (
    <Card>
      <View
        style={{
          alignSelf: 'center',
          backgroundColor: '#DFF4ED',
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 20,
        }}
      >
        <Txt style={{ color: '#168266', fontFamily: 'TajawalBold' }}>
          مشارك مؤكد ✓
        </Txt>
      </View>
      <Title>تم التحقق من المشاركة</Title>
      <View
        style={{
          alignSelf: 'center',
          width: 112,
          height: 112,
          borderRadius: 56,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#168F79',
          borderWidth: 4,
          borderColor: '#E8C66B',
        }}
      >
        <Txt style={{ fontSize: 34 }}>✓</Txt>
        <Txt style={{ color: '#fff', fontSize: 12, fontFamily: 'TajawalBold' }}>
          {badge.kind === 'CERTIFICATE' ? 'شهادة حضور' : 'شارة معتمدة'}
        </Txt>
      </View>
      <Txt style={{ fontFamily: 'TajawalBold', fontSize: 20 }}>
        {badge.event.title}
      </Txt>
      <Txt>
        {badge.holder.name} · {badge.event.section.nameAr}
      </Txt>
      <Txt style={{ color: c.muted }}>
        {badge.event.organizer.name} · {badge.role?.name ?? 'متطوع'}
      </Txt>
      {!!badge.description && <Txt>{badge.description}</Txt>}
      <Txt style={{ color: c.muted }}>
        تاريخ الاعتماد:{' '}
        {badge.decidedAt
          ? new Date(badge.decidedAt).toLocaleDateString('ar')
          : '—'}
      </Txt>
    </Card>
  );
}

function OfflineCv({
  cv,
  source,
}: {
  cv: OfflineVolunteerCv;
  source: 'online' | 'offline';
}) {
  const c = useColors();
  return (
    <Card>
      <View
        style={{
          alignSelf: 'center',
          backgroundColor: source === 'online' ? c.icy : '#FFF4DC',
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 20,
        }}
      >
        <Txt
          style={{
            color: source === 'online' ? c.primaryInk : '#8D6B25',
            fontFamily: 'TajawalBold',
          }}
        >
          {source === 'online'
            ? 'السيرة الحالية من واثق'
            : `نسخة موقّعة بتاريخ ${dateText(cv.generatedAt)} · دون اتصال`}
        </Txt>
      </View>
      <Title>{cv.person.name}</Title>
      <Txt>{cv.person.bio || 'سيرة تطوعية على منصة واثق'}</Txt>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat value={cv.stats.volunteerHours} label="ساعة موثقة" />
        <Stat value={cv.stats.approvedBadges} label="شارة معتمدة" />
        <Stat value={cv.stats.completedEvents} label="فعالية مكتملة" />
      </View>
      <Txt style={{ color: c.muted, fontFamily: 'TajawalBold' }}>
        المشاركات الموثقة ({cv.includedBadgeCount} من {cv.stats.approvedBadges})
      </Txt>
      <Txt style={{ color: c.muted, fontSize: 11 }}>
        الساعات محسوبة من مدد الفعاليات التي اعتمد المنظّم شاراتها.
      </Txt>
      {cv.badges.map((item) => (
        <View
          key={item.id}
          style={{
            padding: 11,
            borderRadius: 18,
            backgroundColor: c.canvas,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <Txt style={{ fontFamily: 'TajawalBold' }}>{item.event.title}</Txt>
          <Txt style={{ color: c.muted, fontSize: 13 }}>
            {item.event.section.nameAr} · {item.role || 'متطوع'} ·{' '}
            {new Date(item.event.startsAt).toLocaleDateString('ar')}
          </Txt>
        </View>
      ))}
      {source === 'offline' ? (
        <Txt style={{ color: c.muted, fontSize: 12 }}>
          نسخة موقّعة من واثق بتاريخ إصدارها، وقد تكون تغيّرت بعده. مع الإنترنت
          يعرض الرابط السيرة الحالية.
        </Txt>
      ) : null}
    </Card>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  const c = useColors();
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderRadius: 18,
        backgroundColor: c.icy,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt
        style={{
          color: c.primaryInk,
          fontSize: 21,
          fontFamily: 'TajawalBold',
          lineHeight: 27,
        }}
      >
        {value}
      </Txt>
      <Txt style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}>
        {label}
      </Txt>
    </View>
  );
}

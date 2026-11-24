import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState as NativeAppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Tajawal_400Regular,
  Tajawal_700Bold,
} from '@expo-google-fonts/tajawal';
import { Cairo_700Bold } from '@expo-google-fonts/cairo';
import { Ionicons } from '@expo/vector-icons';
import { storage } from './storage';
import type { CurrentUser, Paginated, Section } from '@csh/shared';
import { api, logout, onExpired, restoreSession } from './api';
import { AppContext, type Route, useResource } from './state';
import { Button, Card, ThemeContext, Title, Txt, useColors } from './ui';
import { Auth } from './Auth';
import { AccountMenu } from './AccountMenu';
import { Feed } from './feed';
import { Detail, Manage } from './details';
import { Compose } from './compose';
import {
  AccountForm,
  Applications,
  Badges,
  Cv,
  InterestsScreen,
  Me,
  PeopleList,
  ReceivedRatings,
  Search,
  UserProfile,
} from './profile';
import {
  Collaborations,
  JoinTeam,
  Report,
  Requests,
  Teams,
  VerificationReview,
  Verify,
} from './workflows';
import { Admin } from './admin';
import { Inbox, notificationRoute } from './notifications';
import { registerPush, unregisterPush, watchPush } from './push';
import { QrVerification } from './qr';
import { Directory, HonourBoard, MyStats } from './discover';
import { MyPosts } from './myposts';

export default function App() {
  const [dark, setDark] = useState(false);
  const [fonts, fontError] = useFonts({
    Tajawal: Tajawal_400Regular,
    TajawalBold: Tajawal_700Bold,
    Cairo: Cairo_700Bold,
  });
  useEffect(() => {
    void storage.get('wathiq.theme').then((v) => {
      if (v) setDark(v === 'dark');
    });
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={dark}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {fonts || fontError ? (
          <Root
            dark={dark}
            toggleTheme={() => {
              setDark((d) => {
                void storage.set('wathiq.theme', !d ? 'dark' : 'light');
                return !d;
              });
            }}
          />
        ) : (
          <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color="#198996" />
          </SafeAreaView>
        )}
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
function Root({
  dark,
  toggleTheme,
}: {
  dark: boolean;
  toggleTheme: () => void;
}) {
  const c = useColors();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [revision, setRevision] = useState(0);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.72],
    extrapolate: 'clamp',
  });
  const pendingLink = useRef<Route | null>(null);
  const route = stack[stack.length - 1];
  const pageTitle =
    route.name === 'cv'
      ? 'السيرة التطوعية'
      : route.name === 'qr-verify'
        ? 'التحقق QR'
        : route.name === 'events'
          ? 'التطوع'
          : route.name === 'search'
            ? 'اكتشف'
            : route.name === 'me'
              ? 'حسابي'
              : route.name === 'compose'
                ? 'إضافة'
                : 'الرئيسية';
  const go = useCallback((r: Route) => {
    setStack((s) => [...s, r]);
    setRevision((n) => n + 1);
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: 'home' }]));
    setRevision((n) => n + 1);
  }, []);
  const loadSections = async () => {
    const res = await api<Paginated<Section>>('/sections?limit=100');
    setSections(res.data);
  };
  const bootstrap = async () => {
    setLoading(true);
    setError('');
    try {
      if (await restoreSession()) {
        const user = await api<CurrentUser>('/auth/me');
        await loadSections();
        setMe(user);
        setStack([pendingLink.current ?? { name: 'home' }]);
        pendingLink.current = null;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الاتصال');
    } finally {
      setLoading(false);
    }
  };
  const reloadMe = async () => {
    setMe(await api<CurrentUser>('/auth/me'));
  };
  useEffect(() => {
    onExpired(() => {
      setAccountMenuOpen(false);
      setMe(null);
      setStack([{ name: 'home' }]);
      setError('');
    });
    void bootstrap();
    return () => onExpired(() => {});
  }, []);
  const signedIn = async (user: CurrentUser) => {
    setLoading(true);
    try {
      await loadSections();
      setMe(user);
      setStack([
        pendingLink.current ??
          (user.pendingOrganization ? { name: 'verify' } : { name: 'home' }),
      ]);
      pendingLink.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التحميل');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    scrollY.setValue(0);
  }, [stack, revision]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1 && route.name === 'home') return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [stack.length, route.name, back]);
  useEffect(() => {
    const openUrl = (url: string) => {
      const match = url.match(/^wathiq:\/\/(posts|events|users)\/(\d+)\/?$/);
      if (!match) return;
      const r: Route = {
        name: match[1] === 'users' ? 'user' : 'post',
        id: Number(match[2]),
        kind: match[1] === 'events' ? 'EVENT' : undefined,
      };
      if (me) go(r);
      else pendingLink.current = r;
    };
    const sub = Linking.addEventListener('url', (e) => openUrl(e.url));
    void Linking.getInitialURL().then((url) => {
      if (url && !me) openUrl(url);
    });
    return () => sub.remove();
  }, [!!me, go]);
  useEffect(() => {
    if (!me) return;
    void registerPush().catch(() => {});
    return watchPush((data) => {
      const id = Number(data.postId);
      // Push payloads omit decision metadata; open the inbox for those notifications.
      if (String(data.type).startsWith('PUBLISH'))
        go({ name: 'notifications' });
      else
        go(
          notificationRoute(
            {
              type: String(data.type),
              data: {},
              post:
                Number.isSafeInteger(id) && id > 0
                  ? { id, kind: 'EVENT', title: '' }
                  : null,
            },
            me.role,
          ),
        );
    });
  }, [me?.id, go]);
  const signOut = async () => {
    // Keep the session if device unregistration fails: otherwise a shared phone can retain push for the previous account.
    await unregisterPush();
    try {
      await logout();
    } finally {
      setAccountMenuOpen(false);
      setMe(null);
      setStack([{ name: 'home' }]);
      setSections([]);
      setError('');
    }
  };
  const content = loading ? (
    <ActivityIndicator style={{ marginTop: 70 }} color={c.primary} />
  ) : error ? (
    <Card>
      <Title>تعذّر تحميل واثق</Title>
      <Txt>{error}</Txt>
      <Button title="إعادة المحاولة" onPress={bootstrap} />
    </Card>
  ) : !me ? (
    <Auth
      signedIn={(user) => {
        void signedIn(user);
      }}
    />
  ) : (
    <View style={{ gap: 10 }}>
      {me.pendingOrganization && (
        <Card>
          <Txt>
            حساب الجمعية بانتظار التوثيق: يمكنكم التصفح وتعديل حسابكم فقط، حتى
            يوافق فريق واثق.
          </Txt>
        </Card>
      )}
      <Screen route={route} />
    </View>
  );
  const body = (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.canvas }}
      edges={['top', 'bottom']}
    >
      <View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        style={{ zIndex: 1 }}
      >
        <AppHeader
          me={me}
          pageTitle={pageTitle}
          dark={dark}
          toggleTheme={toggleTheme}
          canGoBack={stack.length > 1 || route.name !== 'home'}
          onHome={() => setStack([{ name: 'home' }])}
          onSettings={() => setAccountMenuOpen(true)}
          onBack={back}
          onSearch={() => go({ name: 'search' })}
          onNotifications={() => go({ name: 'notifications' })}
          revision={revision + notificationRevision}
          opacity={headerOpacity}
        />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1, marginTop: -headerHeight }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: headerHeight + 14,
            paddingHorizontal: 14,
            paddingBottom: 30,
          }}
        >
          <ScreenMotion
            motionKey={`${route.name}-${route.id ?? ''}-${route.kind ?? ''}-${stack.length}-${revision}`}
          >
            {content}
          </ScreenMotion>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      {me && !loading && !error && (
        <View
          style={{
            marginHorizontal: 10,
            marginBottom: 5,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.surface,
            padding: 6,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          {(
            [
              { name: 'home', label: 'الرئيسية', icon: 'home-outline' },
              { name: 'events', label: 'التطوع', icon: 'calendar-outline' },
              ...(!me.pendingOrganization
                ? [
                    {
                      name: 'compose',
                      label: 'أضف',
                      icon: 'add-circle' as const,
                    },
                  ]
                : []),
              { name: 'qr-verify', label: 'تحقق QR', icon: 'scan-outline' },
              ...(!me.pendingOrganization
                ? [
                    {
                      name: 'cv',
                      label: 'سيرتي',
                      icon: 'ribbon-outline' as const,
                    },
                  ]
                : []),
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: route.name === tab.name }}
              accessibilityLabel={tab.label}
              onPress={() => {
                setStack([{ name: tab.name }]);
                setRevision((n) => n + 1);
              }}
              style={{
                flex: 1,
                height: 74,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 3,
                paddingVertical: 6,
                borderRadius: 18,
                backgroundColor: route.name === tab.name ? c.icy : undefined,
              }}
            >
              <View
                style={{
                  width: '100%',
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={tab.name === 'compose' ? 34 : 23}
                  color={
                    route.name === tab.name || tab.name === 'compose'
                      ? c.primaryInk
                      : c.muted
                  }
                />
              </View>
              <Txt
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  fontSize: 11,
                  color: route.name === tab.name ? c.primaryInk : c.muted,
                  width: '100%',
                  textAlign: 'center',
                  writingDirection: 'rtl',
                  includeFontPadding: false,
                }}
              >
                {tab.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
      {me && (
        <AccountMenu
          visible={accountMenuOpen}
          close={() => setAccountMenuOpen(false)}
        />
      )}
    </SafeAreaView>
  );
  return me ? (
    <AppContext.Provider
      value={{
        me,
        sections,
        go,
        back,
        reloadMe,
        signOut,
        dark,
        toggleTheme,
        refreshNotifications: () => setNotificationRevision((n) => n + 1),
      }}
    >
      {body}
    </AppContext.Provider>
  ) : (
    body
  );
}
function AppHeader({
  me,
  pageTitle,
  dark,
  toggleTheme,
  canGoBack,
  onHome,
  onSettings,
  onBack,
  onSearch,
  onNotifications,
  revision,
  opacity,
}: {
  me: CurrentUser | null;
  pageTitle: string;
  dark: boolean;
  toggleTheme: () => void;
  canGoBack: boolean;
  onHome: () => void;
  onSettings: () => void;
  onBack: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  revision: number;
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  const c = useColors();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.surface,
          opacity,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="الرئيسية"
        onPress={onHome}
      >
        <View
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: c.primaryDark,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ color: '#fff', fontFamily: 'Cairo', fontSize: 18 }}>
              و
            </Txt>
          </View>
          <View>
            <Txt
              style={{
                fontFamily: 'Cairo',
                fontSize: 16,
                lineHeight: 22,
                color: c.ink,
              }}
            >
              {pageTitle}
            </Txt>
            <Txt style={{ fontSize: 10, lineHeight: 15, color: c.primaryInk }}>
              منصة واثق
            </Txt>
          </View>
        </View>
      </Pressable>
      {me ? (
        <View
          style={{ flexDirection: 'row-reverse', gap: 5, alignItems: 'center' }}
        >
          <UnreadBell go={onNotifications} revision={revision} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="البحث"
            onPress={onSearch}
            style={{
              padding: 9,
              backgroundColor: c.canvas,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Ionicons name="search-outline" size={20} color={c.ink} />
          </Pressable>
          <ThemeButton dark={dark} toggle={toggleTheme} />
          {canGoBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              onPress={onBack}
              style={{ padding: 8 }}
            >
              <Ionicons name="arrow-forward" size={23} color={c.ink} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="فتح الإعدادات"
            onPress={onSettings}
            style={{ padding: 8 }}
          >
            <Ionicons name="menu-outline" size={26} color={c.ink} />
          </Pressable>
        </View>
      ) : (
        <ThemeButton dark={dark} toggle={toggleTheme} />
      )}
    </View>
  );
}
function ScreenMotion({
  motionKey,
  children,
}: {
  motionKey: string;
  children: React.ReactNode;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [entrance, motionKey]);
  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
function ThemeButton({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الداكن'}
      onPress={toggle}
      style={{ padding: 10, borderRadius: 16, backgroundColor: c.icy }}
    >
      <Ionicons
        name={dark ? 'sunny-outline' : 'moon-outline'}
        size={22}
        color={c.primaryInk}
      />
    </Pressable>
  );
}
function UnreadBell({ go, revision }: { go: () => void; revision: number }) {
  const c = useColors();
  const r = useResource<{ count: number }>(
    '/notifications/unread-count',
    revision,
  );
  useEffect(() => {
    const sub = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') r.reload();
    });
    return () => sub.remove();
  }, []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`الإشعارات${r.data ? `، ${r.data.count} غير مقروءة` : ''}`}
      onPress={go}
      style={{ padding: 10 }}
    >
      <Ionicons name="notifications-outline" size={24} color={c.ink} />
      {!!r.data?.count && (
        <View
          style={{
            position: 'absolute',
            right: 2,
            top: 0,
            backgroundColor: '#B84863',
            borderRadius: 12,
            paddingHorizontal: 5,
          }}
        >
          <Txt
            style={{
              fontSize: 10,
              color: 'white',
              lineHeight: 17,
              minWidth: 12,
              textAlign: 'center',
              includeFontPadding: false,
            }}
          >
            {r.data.count > 99 ? '99+' : r.data.count}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}
function Screen({ route: r }: { route: Route }) {
  switch (r.name) {
    case 'home':
      return <Feed />;
    case 'events':
      return <Feed events />;
    case 'my-events':
    case 'my-posts':
      return <MyPosts />;
    case 'post':
      return <Detail id={r.id!} kind={r.kind} />;
    case 'manage':
      return <Manage id={r.id!} />;
    case 'compose':
      return <Compose id={r.id} kind={r.kind} targetId={r.targetId} />;
    case 'me':
      return <Me />;
    case 'security':
    case 'profile-edit':
    case 'privacy':
    case 'delete-account':
    case 'specialties':
      return <AccountForm kind={r.name} />;
    case 'interests':
      return <InterestsScreen />;
    case 'user':
      return <UserProfile id={r.id!} />;
    case 'applications':
      return <Applications />;
    case 'badges':
      return <Badges />;
    case 'cv':
      return <Cv />;
    case 'qr-verify':
      return <QrVerification />;
    case 'search':
      return <Search />;
    case 'following':
      return <PeopleList path="/users/me/following" />;
    case 'ratings':
      return <ReceivedRatings />;
    case 'notifications':
      return <Inbox />;
    case 'requests':
      return <Requests />;
    case 'collaborations':
      return <Collaborations postId={r.id} />;
    case 'teams':
      return <Teams incoming={r.kind === 'incoming'} />;
    case 'join-team':
      return <JoinTeam id={r.id!} />;
    case 'verify':
      return <Verify />;
    case 'verification-review':
      return <VerificationReview id={r.id!} />;
    case 'report':
      return <Report id={r.id!} kind={r.kind!} />;
    case 'admin':
      return <Admin initialTab={r.kind} />;
    case 'highlights':
      return <HonourBoard />;
    case 'directory':
      return <Directory />;
    case 'stats':
      return <MyStats />;
    default:
      return <Feed />;
  }
}

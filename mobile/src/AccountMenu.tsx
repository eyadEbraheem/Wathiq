import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Title, Txt, useColors } from './ui';
import { type Route, useApp } from './state';
import { isOrganization } from './accounts';

export function AccountMenu({
  visible,
  close,
}: {
  visible: boolean;
  close: () => void;
}) {
  const { me, go, signOut } = useApp();
  const c = useColors();
  const organization = isOrganization(me);
  const open = (route: Route) => {
    close();
    go(route);
  };
  const links: [string, Route][] = [
    ['عرض ملفي', { name: 'user', id: me.id }],
    ['حسابي والإعدادات', { name: 'me' }],
    ['تعديل الملف الشخصي', { name: 'profile-edit' }],
    ['الحساب وكلمة المرور', { name: 'security' }],
    ['الخصوصية', { name: 'privacy' }],
    [organization ? 'أقسام عملنا' : 'اهتماماتي', { name: 'interests' }],
    ['الإشعارات', { name: 'notifications' }],
    ['الجمعيات والحسابات الموثّقة', { name: 'directory' }],
    ['جمعية الأسبوع', { name: 'highlights' }],
    ...(!organization
      ? ([
          ['سيرتي التطوعية', { name: 'cv' }],
          ['شاراتي وشهاداتي', { name: 'badges' }],
        ] as [string, Route][])
      : []),
    ['طلبات التطوع', { name: 'applications' }],
    ['الحسابات التي أتابعها', { name: 'following' }],
    ...(!organization
      ? ([['عضوياتي في الفرق', { name: 'teams' }]] as [string, Route][])
      : []),
    ['دعوات التعاون', { name: 'collaborations' }],
    ['طلبات النشر', { name: 'requests' }],
    ['توثيق الحساب', { name: 'verify' }],
  ];
  if (me.verifiedKind)
    links.push(
      ['إحصائيات حملاتنا', { name: 'stats' }],
      ['التقييمات الواردة', { name: 'ratings' }],
      ['تخصصاتي', { name: 'specialties' }],
      ['منشوراتي ومبادراتي', { name: 'my-posts' }],
      ['طلبات عضوية فريقي', { name: 'teams', kind: 'incoming' }],
    );
  if (me.role === 'ADMIN') links.push(['لوحة الإدارة', { name: 'admin' }]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق قائمة الحساب"
          onPress={close}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            maxHeight: '85%',
            backgroundColor: c.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 18,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.line,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />
          <Title>{me.name}</Title>
          <Txt>حسابي على واثق</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
            onPress={close}
            style={{
              backgroundColor: c.icy,
              minHeight: 44,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 18,
            }}
          >
            <Txt style={{ fontFamily: 'TajawalBold', fontSize: 16 }}>إغلاق</Txt>
          </Pressable>
          <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {links.map(([title, route]) => (
              <Button
                key={title}
                subtle
                title={title}
                onPress={() => open(route)}
              />
            ))}
            <Button
              title="تسجيل الخروج"
              onPress={async () => {
                await signOut();
                close();
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

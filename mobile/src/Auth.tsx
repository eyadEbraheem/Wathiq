import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { AuthTokens, CurrentUser } from '@csh/shared';
import { ApiError, api, setSession } from './api';
import { Form, field } from './forms';
import { Button, Card, Row, Title, Txt } from './ui';

export function Auth({ signedIn }: { signedIn: (me: CurrentUser) => void }) {
  const [mode, setMode] = useState('login');
  const [signupId, setSignupId] = useState<number>();
  const [identifier, setIdentifier] = useState('');
  const [organization, setOrganization] = useState(false);
  const enter = async (result: { user: CurrentUser; tokens: AuthTokens }) => {
    await setSession(result.tokens);
    signedIn(result.user);
  };
  return (
    <View style={{ gap: 18 }}>
      <LinearGradient
        colors={['#13263A', '#1E3A56', '#198996']}
        style={{
          padding: 28,
          borderRadius: 32,
          borderBottomRightRadius: 9,
          gap: 14,
        }}
      >
        <Ionicons
          name="leaf-outline"
          size={50}
          color="#5FD3E0"
          style={{ alignSelf: 'flex-end' }}
        />
        <Txt
          style={{
            fontFamily: 'Cairo',
            fontSize: 42,
            lineHeight: 65,
            color: 'white',
          }}
        >
          واثق
        </Txt>
        <Txt style={{ color: '#D6E7EC', fontSize: 20 }}>
          أثر صغير منك، فرق كبير لمجتمعك.
        </Txt>
        <Txt style={{ color: '#D6E7EC' }}>
          اكتشف المبادرات، شارك بوقتك، وخلّي أثرك يكبر.
        </Txt>
      </LinearGradient>
      <Card>
        <Title>
          {
            (
              {
                login: 'أهلاً بعودتك',
                signup: 'لنبدأ رحلتك',
                verify: 'تأكيد حسابك',
                forgot: 'استعادة كلمة المرور',
                reset: 'كلمة مرور جديدة',
              } as Record<string, string>
            )[mode]
          }
        </Title>
        {mode === 'login' && (
          <Form
            fields={[
              field('identifier', 'البريد الإلكتروني أو الهاتف', 'text', true),
              field('password', 'كلمة المرور', 'password', true),
            ]}
            title="تسجيل الدخول"
            submit={async (v) =>
              enter(
                await api(
                  '/auth/login',
                  'POST',
                  { ...v, deviceInfo: `Wathiq / ${Platform.OS}` },
                  true,
                ),
              )
            }
          />
        )}
        {mode === 'signup' && (
          <Form
            fields={[
              field(
                'name',
                organization ? 'اسم الجمعية أو الفريق' : 'الاسم الكامل',
                'text',
                true,
              ),
              field(
                'birthDate',
                organization ? 'تاريخ التأسيس' : 'تاريخ الميلاد',
                'date',
                true,
              ),
              field('email', 'البريد الإلكتروني', 'text', true),
              field(
                'password',
                'كلمة المرور (8 أحرف على الأقل)',
                'password',
                true,
              ),
            ]}
            title="إنشاء حساب"
            submit={async (v) => {
              try {
                const result = await api<{ signupId: number }>(
                  '/auth/signup',
                  'POST',
                  { ...v, locale: 'ar', organization },
                  true,
                );
                setSignupId(result.signupId);
                setMode('verify');
              } catch (error) {
                if (error instanceof ApiError && error.status === 503) {
                  throw new Error(
                    'تعذّر إرسال الرمز من خادم البريد. تأكد أن EXPO_PUBLIC_API_URL يشير إلى خادم API نفسه الذي يستخدمه الويب، ثم راجع سجل خادم API.',
                  );
                }
                throw error;
              }
            }}
          />
        )}
        {mode === 'verify' && (
          <>
            <Txt>أدخل الرمز الذي وصلك إلى وسيلة التواصل المختارة.</Txt>
            <Form
              fields={[field('code', 'رمز التأكيد', 'text', true)]}
              title="تأكيد الحساب"
              submit={async (v) =>
                enter(
                  await api(
                    '/auth/signup/verify',
                    'POST',
                    { ...v, signupId, deviceInfo: `Wathiq / ${Platform.OS}` },
                    true,
                  ),
                )
              }
            />
            <Button
              subtle
              title="إعادة إرسال الرمز"
              onPress={() =>
                api('/auth/signup/resend', 'POST', { signupId }, true)
              }
            />
          </>
        )}
        {mode === 'forgot' && (
          <Form
            fields={[
              field('identifier', 'البريد الإلكتروني أو الهاتف', 'text', true),
            ]}
            title="إرسال رمز الاستعادة"
            submit={async (v) => {
              await api('/auth/password/forgot', 'POST', v, true);
              setIdentifier(String(v.identifier));
              setMode('reset');
            }}
          />
        )}
        {mode === 'reset' && (
          <Form
            fields={[
              field('code', 'رمز الاستعادة', 'text', true),
              field('newPassword', 'كلمة المرور الجديدة', 'password', true),
            ]}
            title="تغيير كلمة المرور"
            submit={(v) =>
              api('/auth/password/reset', 'POST', { ...v, identifier }, true)
            }
            after={() => setMode('login')}
          />
        )}
      </Card>
      <Row>
        {mode !== 'login' && (
          <Button subtle title="لدي حساب" onPress={() => setMode('login')} />
        )}
        {mode === 'login' && (
          <>
            <Button
              subtle
              title={organization ? 'التسجيل كفرد' : 'التسجيل كجمعية أو فريق'}
              onPress={() => setOrganization(!organization)}
            />
            <Button
              subtle
              title="إنشاء حساب"
              onPress={() => setMode('signup')}
            />
            <Button
              subtle
              title="نسيت كلمة المرور"
              onPress={() => setMode('forgot')}
            />
          </>
        )}
      </Row>
    </View>
  );
}

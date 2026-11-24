import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type TextProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME } from '@csh/shared';

export const ThemeContext = createContext(false);
export function useColors() {
  return THEME[useContext(ThemeContext) ? 'dark' : 'light'];
}
export function Txt({ style, ...props }: TextProps) {
  const c = useColors();
  return (
    <Text
      {...props}
      style={[
        {
          color: c.ink,
          fontFamily: 'Tajawal',
          fontSize: 16,
          textAlign: 'center',
          textAlignVertical: 'center',
          writingDirection: 'rtl',
          lineHeight: 25,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Txt
      style={{
        fontFamily: 'Cairo',
        fontSize: 22,
        lineHeight: 36,
        textAlign: 'center',
        textAlignVertical: 'center',
      }}
    >
      {children}
    </Txt>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [entrance]);
  return (
    <Animated.View
      style={[
        {
          backgroundColor: c.surface,
          padding: 14,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: c.line,
          gap: 12,
          marginBottom: 16,
          shadowColor: '#13263A',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.055,
          shadowRadius: 24,
          elevation: 2,
        },
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
export function Button({
  title,
  onPress,
  subtle = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void | Promise<unknown>;
  subtle?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const press = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      speed: 32,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={{
        maxWidth: '100%',
        flexShrink: 1,
        transform: [{ scale }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={busy || disabled}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        onPress={async () => {
          setBusy(true);
          try {
            await onPress();
          } catch (e) {
            Alert.alert(
              'تعذّر إتمام الطلب',
              e instanceof Error ? e.message : 'حاول مجدداً',
            );
          } finally {
            setBusy(false);
          }
        }}
        style={{
          maxWidth: '100%',
          opacity: disabled || busy ? 0.5 : 1,
        }}
      >
        <LinearGradient
          colors={
            subtle
              ? [c.icy, c.icy]
              : danger
                ? ['#D45D79', '#B84863']
                : [c.primaryLight, c.primaryDark]
          }
          style={{
            padding: 12,
            paddingHorizontal: 18,
            minHeight: 44,
            borderRadius: 24,
            borderTopRightRadius: 8,
            borderBottomLeftRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {busy ? (
            <ActivityIndicator color={subtle ? c.primaryInk : '#fff'} />
          ) : (
            <Txt
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                color: subtle ? c.ink : '#fff',
                fontFamily: 'TajawalBold',
                width: '100%',
                flexShrink: 1,
                textAlign: 'center',
                writingDirection: 'rtl',
                includeFontPadding: false,
              }}
            >
              {title}
            </Txt>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
export function Input({
  label,
  value,
  onChange,
  secure,
  multiline,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  multiline?: boolean;
  numeric?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 5 }}>
      <Txt>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize="none"
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholderTextColor={c.muted}
        style={{
          color: c.ink,
          backgroundColor: c.icy,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 15,
          padding: 13,
          fontFamily: 'Tajawal',
          fontSize: 16,
          textAlign: 'center',
          textAlignVertical: multiline ? 'top' : 'center',
          writingDirection: 'rtl',
          includeFontPadding: false,
          minHeight: multiline ? 100 : 50,
        }}
      />
    </View>
  );
}
export function Row({
  children,
  centered = true,
  wrap = true,
}: {
  children: React.ReactNode;
  centered?: boolean;
  wrap?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: 'center',
        justifyContent: centered ? 'center' : 'flex-start',
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}
export function Chip({
  title,
  active,
  onPress: handlePress,
  color,
}: {
  title: string;
  active?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const c = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const press = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      speed: 34,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={{
        maxWidth: '100%',
        flexShrink: 1,
        transform: [{ scale }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={handlePress}
        onPressIn={() => press(0.94)}
        onPressOut={() => press(1)}
        style={{
          paddingHorizontal: 15,
          paddingVertical: 9,
          borderRadius: active ? 18 : 18,
          borderTopRightRadius: active ? 18 : 6,
          borderBottomLeftRadius: active ? 18 : 6,
          backgroundColor: active ? (color ?? c.primaryDark) : c.icy,
          borderWidth: 1,
          borderColor: active ? (color ?? c.primary) : c.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.68}
          style={{
            color: active ? '#fff' : c.ink,
            fontSize: 14,
            fontFamily: 'TajawalBold',
            width: '100%',
            flexShrink: 1,
            textAlign: 'center',
            writingDirection: 'rtl',
            includeFontPadding: false,
          }}
        >
          {title}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}
export function Photo({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      accessibilityLabel="صورة مرفقة"
      style={{
        width: '100%',
        height: 210,
        borderRadius: 20,
        backgroundColor: '#DCECEF',
      }}
      resizeMode="cover"
    />
  );
}
export function Confirm({
  title,
  action,
}: {
  title: string;
  action: () => Promise<unknown>;
}) {
  return (
    <Button
      danger
      title={title}
      onPress={() =>
        new Promise<void>((resolve) =>
          Alert.alert(
            title,
            'هل تريد المتابعة؟',
            [
              { text: 'تراجع', onPress: () => resolve(), style: 'cancel' },
              {
                text: 'تأكيد',
                style: 'destructive',
                onPress: () => {
                  action()
                    .then(() => resolve())
                    .catch((e) => {
                      Alert.alert('تعذّر الإجراء', String(e));
                      resolve();
                    });
                },
              },
            ],
            { cancelable: false },
          ),
        )
      }
    />
  );
}

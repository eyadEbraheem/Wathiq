import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { SECTION_COLORS, type SectionSlug } from '@csh/shared';
import { Txt, useColors } from './ui';
import { useApp } from './state';

const icons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  humanitarian: 'heart',
  environment: 'leaf',
  'animal-welfare': 'paw',
  community: 'people',
  education: 'school',
};

function TreeBranch({
  d,
  color,
  active,
  delay,
}: {
  d: string;
  color: string;
  active: boolean;
  delay: number;
}) {
  const path = useRef<React.ElementRef<typeof Path>>(null);
  useEffect(() => {
    const offset = new Animated.Value(active ? 36 : 180);
    const listener = offset.addListener(({ value }) => {
      path.current?.setNativeProps({ strokeDashoffset: value });
    });
    const animation = active
      ? Animated.loop(
          Animated.timing(offset, {
            toValue: 0,
            duration: 1100,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        )
      : Animated.timing(offset, {
          toValue: 0,
          delay,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        });
    animation.start();
    return () => {
      animation.stop();
      offset.removeListener(listener);
    };
  }, [active, delay, d]);
  return (
    <Path
      ref={path}
      d={d}
      stroke={color}
      strokeWidth={active ? 3.2 : 2}
      opacity={active ? 1 : 0.42}
      strokeDasharray={active ? '12 6' : '180'}
      strokeDashoffset={active ? 36 : 180}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function TreeLeaf({
  name,
  slug,
  color,
  ink,
  active,
  delay,
  onPress,
  compact = false,
}: {
  name: string;
  slug: string;
  color: string;
  ink: string;
  active: boolean;
  delay: number;
  onPress: () => void;
  compact?: boolean;
}) {
  const c = useColors();
  const entrance = useRef(new Animated.Value(0.82)).current;
  const pressed = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    entrance.setValue(0.82);
    Animated.spring(entrance, {
      toValue: 1,
      delay,
      speed: 15,
      bounciness: 9,
      useNativeDriver: true,
    }).start();
  }, [delay, entrance]);
  const press = (toValue: number) =>
    Animated.spring(pressed, {
      toValue,
      speed: 32,
      bounciness: 9,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ scale: Animated.multiply(entrance, pressed) }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={() => press(0.93)}
        onPressOut={() => press(1)}
        style={{
          minHeight: compact ? 62 : 68,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 2,
          gap: 4,
          borderRadius: active ? 6 : 18,
          borderTopRightRadius: active ? 18 : 6,
          borderBottomLeftRadius: active ? 18 : 6,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: active ? color : c.icy,
        }}
      >
        <Ionicons
          name={icons[slug] ?? 'ellipse'}
          size={20}
          color={active ? 'white' : ink}
        />
        <Txt
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          style={{
            fontSize: 11,
            lineHeight: 18,
            width: '100%',
            flexShrink: 1,
            textAlign: 'center',
            writingDirection: 'rtl',
            includeFontPadding: false,
            color: active ? 'white' : c.ink,
          }}
        >
          {name}
        </Txt>
      </Pressable>
    </Animated.View>
  );
}

export function CategoryTree({
  selected,
  onSelect,
}: {
  selected?: number;
  onSelect: (id: number | undefined) => void;
}) {
  const { sections, dark } = useApp();
  const c = useColors();
  const visibleSections = [{ id: 0, slug: 'all', nameAr: 'الكل' }, ...sections];
  const badge = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.spring(badge, {
      toValue: 1,
      speed: 14,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  }, [badge]);
  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Animated.View
        style={{
          backgroundColor: c.primaryDark,
          paddingHorizontal: 20,
          paddingVertical: 5,
          borderRadius: 18,
          borderTopRightRadius: 6,
          borderBottomLeftRadius: 6,
          transform: [{ scale: badge }],
        }}
      >
        <Txt
          style={{
            color: 'white',
            fontFamily: 'TajawalBold',
            fontSize: 13,
            textAlign: 'center',
            writingDirection: 'rtl',
            includeFontPadding: false,
          }}
        >
          الأقسام الرئيسية
        </Txt>
      </Animated.View>
      <Svg
        width="100%"
        height={38}
        viewBox="0 0 340 48"
        accessibilityElementsHidden
      >
        {visibleSections.map((section, index) => {
          const x = 340 - (index + 0.5) * (340 / visibleSections.length);
          const look =
            SECTION_COLORS[section.slug as SectionSlug]?.[
              dark ? 'dark' : 'light'
            ];
          return (
            <TreeBranch
              key={section.id}
              d={`M 170 2 C 170 24, ${x} 14, ${x} 46`}
              color={look?.base ?? c.primary}
              active={(selected ?? 0) === section.id}
              delay={index * 70}
            />
          );
        })}
        <Circle cx={170} cy={3} r={4} fill={c.primary} />
      </Svg>
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 5,
          width: '100%',
        }}
      >
        {visibleSections.map((section, index) => {
          const look =
            SECTION_COLORS[section.slug as SectionSlug]?.[
              dark ? 'dark' : 'light'
            ];
          return (
            <TreeLeaf
              key={section.id}
              name={section.nameAr}
              slug={section.slug}
              color={look?.base ?? c.primary}
              ink={look?.ink ?? c.primaryInk}
              active={(selected ?? 0) === section.id}
              delay={180 + index * 65}
              onPress={() => onSelect(section.id || undefined)}
              compact
            />
          );
        })}
      </View>
    </View>
  );
}

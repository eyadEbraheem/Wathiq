// Wathiq theme colors (docs/design: "deep teal" reference). Web (Tailwind) and mobile read the
// same values from here. Dark values are lighter so they stay visible on the dark surfaces.

export interface ThemeColor {
  /** The color itself (icons, fills, borders). */
  base: string;
  /** Text in this color on a light or tinted surface (readable contrast). */
  ink: string;
}

export interface ModeColors {
  light: ThemeColor;
  dark: ThemeColor;
}

/** Section slugs as seeded by the API. */
export const SECTION_SLUGS = [
  'humanitarian',
  'environment',
  'animal-welfare',
  'community',
  'education',
] as const;
export type SectionSlug = (typeof SECTION_SLUGS)[number];

/**
 * One color per section. Humanitarian, environment and animal welfare come from the reference;
 * community (honey gold) and education (sapphire) were added to match them.
 */
export const SECTION_COLORS: Record<SectionSlug, ModeColors> = {
  humanitarian: {
    light: { base: '#D45D79', ink: '#A63A57' },
    dark: { base: '#E27A93', ink: '#F2A9BB' },
  },
  environment: {
    light: { base: '#1FA383', ink: '#13785F' },
    dark: { base: '#3DBE9C', ink: '#8EDDC6' },
  },
  'animal-welfare': {
    light: { base: '#7360C6', ink: '#5243A0' },
    dark: { base: '#8E7EDB', ink: '#C2B8F0' },
  },
  community: {
    light: { base: '#C99B52', ink: '#8A6424' },
    dark: { base: '#D9B372', ink: '#EBD3A6' },
  },
  education: {
    light: { base: '#3B7DD8', ink: '#255EA8' },
    dark: { base: '#6C9EEA', ink: '#AFCBF5' },
  },
};

/** The app's surfaces, text and primary (deep teal) in light and dark mode. */
export const THEME = {
  light: {
    canvas: '#F3F8FA',
    surface: '#FFFFFF',
    icy: '#EBF6F8',
    line: '#D6E7EC',
    ink: '#13263A',
    inkSoft: '#1E3A56',
    muted: '#546E7A',
    primary: '#23A6B5',
    primaryLight: '#33C1D1',
    primaryDark: '#198996',
    primaryInk: '#198996',
  },
  dark: {
    canvas: '#0B1622',
    surface: '#13263A',
    icy: '#182F45',
    line: '#24425E',
    ink: '#EAF2F5',
    inkSoft: '#C9DAE3',
    muted: '#8FA9B8',
    primary: '#23A6B5',
    primaryLight: '#33C1D1',
    primaryDark: '#198996',
    primaryInk: '#5FD3E0',
  },
} as const;

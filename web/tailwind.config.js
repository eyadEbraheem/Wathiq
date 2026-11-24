/**
 * واثق design tokens: the "deep teal" reference (docs/design/reference-web.html).
 * Every color is a CSS variable with a light value on :root and a dark value on .dark, both
 * generated from @csh/shared (theme.ts), so each color has its dark-mode counterpart and the
 * mobile app uses the same hex values. Use the color names below, never raw hex in pages.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config file */
const plugin = require("tailwindcss/plugin");
const { THEME, SECTION_COLORS, SECTION_SLUGS } = require("@csh/shared");

/** "#23A6B5" -> "35 166 181" (so Tailwind opacity modifiers like /15 work). */
function channels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const SURFACE_KEYS = {
  canvas: "canvas",
  surface: "surface",
  icy: "icy",
  line: "line",
  ink: "ink",
  "ink-soft": "inkSoft",
  muted: "muted",
  primary: "primary",
  "primary-light": "primaryLight",
  "primary-dark": "primaryDark",
  "primary-ink": "primaryInk",
};

function vars(mode) {
  const out = {};
  for (const [name, key] of Object.entries(SURFACE_KEYS)) {
    out[`--c-${name}`] = channels(THEME[mode][key]);
  }
  for (const slug of SECTION_SLUGS) {
    out[`--c-${slug}`] = channels(SECTION_COLORS[slug][mode].base);
    out[`--c-${slug}-ink`] = channels(SECTION_COLORS[slug][mode].ink);
  }
  return out;
}

const color = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const sectionColors = Object.fromEntries(
  SECTION_SLUGS.map((slug) => [slug, { DEFAULT: color(slug), ink: color(`${slug}-ink`) }]),
);

module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: color("canvas"),
        surface: color("surface"),
        icy: color("icy"),
        line: color("line"),
        ink: { DEFAULT: color("ink"), soft: color("ink-soft") },
        muted: color("muted"),
        primary: {
          DEFAULT: color("primary"),
          light: color("primary-light"),
          dark: color("primary-dark"),
          ink: color("primary-ink"),
        },
        ...sectionColors,
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "var(--font-cairo)", "system-ui", "sans-serif"],
        display: ["var(--font-cairo)", "var(--font-tajawal)", "sans-serif"],
      },
      borderRadius: {
        card: "28px",
        panel: "32px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(19, 38, 58, 0.055)",
        "soft-hover": "0 18px 40px rgba(19, 38, 58, 0.095)",
        glow: "0 10px 24px -6px rgba(35, 166, 181, 0.45)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": vars("light"),
        ".dark": vars("dark"),
        // Paper is white: printing (the CV) always uses the light colors.
        "@media print": { ".dark": vars("light") },
      });
    }),
  ],
};

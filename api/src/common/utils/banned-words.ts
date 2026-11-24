import { normalizeArabic } from 'src/common/utils/arabic';

/** Splits normalized text into words: anything that is not a letter or digit separates. */
function words(text: string): string[] {
  return normalizeArabic(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * True when `text` contains one of the banned entries as whole words, after Arabic
 * normalization. Entries are stored already normalized and may be phrases ("كس امك").
 */
export function containsBannedWord(text: string, banned: string[]): boolean {
  const padded = ` ${words(text).join(' ')} `;
  return banned.some((entry) => {
    const phrase = words(entry).join(' ');
    return phrase !== '' && padded.includes(` ${phrase} `);
  });
}

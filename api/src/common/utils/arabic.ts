// Arabic text normalization used for matching: search, specialties, impact metric labels and
// banned words. The migration that backfills users.search_name uses the same rules in SQL, so
// keep the two in sync.
//
// - أ إ آ ٱ -> ا, ة -> ه, ى -> ي
// - strip tashkeel (U+064B..U+065F, U+0670) and tatweel (U+0640)
// - lower-case Latin letters, trim, collapse whitespace

const LETTER_MAP: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
};

const LETTERS = /[أإآٱةى]/g;
const MARKS = /[ً-ٰٟـ]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(LETTERS, (ch) => LETTER_MAP[ch] ?? ch)
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

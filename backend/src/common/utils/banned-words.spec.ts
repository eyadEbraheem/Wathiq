import { containsBannedWord } from 'src/common/utils/banned-words';

describe('containsBannedWord', () => {
  const banned = ['غبي', 'كس امك', 'shit'];

  it('finds a banned word whatever its spelling, marks or punctuation', () => {
    expect(containsBannedWord('إنتَ غبيّ!', banned)).toBe(true);
    expect(containsBannedWord('SHIT, really', banned)).toBe(true);
  });

  it('finds banned phrases across punctuation and spaces', () => {
    expect(containsBannedWord('كس   أمك.', banned)).toBe(true);
  });

  it('matches whole words only', () => {
    expect(containsBannedWord('غبيه', ['غبي'])).toBe(false);
    expect(containsBannedWord('mishit', banned)).toBe(false);
  });

  it('accepts clean text', () => {
    expect(containsBannedWord('شكراً لجهودكم في الحملة', banned)).toBe(false);
  });
});

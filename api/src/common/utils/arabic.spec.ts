import { normalizeArabic } from 'src/common/utils/arabic';

describe('normalizeArabic', () => {
  it('unifies alef forms, taa marbuta and alef maqsura', () => {
    expect(normalizeArabic('أصدقاء إنسانية آمنة مستشفى')).toBe(
      'اصدقاء انسانيه امنه مستشفي',
    );
  });

  it('matches spelling variants of the same word', () => {
    expect(normalizeArabic('جمعية')).toBe(normalizeArabic('جمعيه'));
    expect(normalizeArabic('أشجار مزروعة')).toBe(
      normalizeArabic('اشجار مزروعه'),
    );
  });

  it('strips tashkeel and tatweel', () => {
    expect(normalizeArabic('مَدْرَسَةٌ')).toBe('مدرسه');
    expect(normalizeArabic('جمــعية')).toBe('جمعيه');
  });

  it('lower-cases, trims and collapses spaces', () => {
    expect(normalizeArabic('  Green   TEAM  ')).toBe('green team');
  });
});

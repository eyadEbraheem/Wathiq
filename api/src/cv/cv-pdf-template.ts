import {
  EDUCATION_LABELS_AR,
  GOVERNORATE_LABELS_AR,
  THEME,
  type EducationLevel,
  type Governorate,
} from '@csh/shared';
import type { CvService } from 'src/cv/cv.service';

export type VolunteerCv = Awaited<ReturnType<CvService['build']>>;

/** Same wording as the web's CvSheet (web/src/components/cv/CvSheet.tsx). */
const HOURS_NOTE =
  'ساعات التطوع هي مجموع ساعات الفعاليات المكتملة التي شارك فيها المتطوع، وفق ساعات الفعالية التي سجّلها المنظّم.';

/** Dates as the web shows them: Syria's time zone, Latin digits. */
const dayFormat = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Damascus',
});
const day = (date: Date) => dayFormat.format(date);

/** Everything user-typed goes through here: the PDF page is HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const yearRange = (start: number | null, end: number | null) =>
  start ? `${start} – ${end ?? 'حتى الآن'}` : '';

const stat = (value: number, label: string) =>
  `<div class="stat"><b>${value}</b><span>${escapeHtml(label)}</span></div>`;

/**
 * The line at the bottom of every page: whose CV it is and "صفحة 2 من 6", so loose printed
 * pages can be put back together. Chrome fills in the page numbers. It is drawn apart from the
 * page, so it cannot use the page's fonts or styles: system font, inline styles only.
 */
export function cvPdfFooter(cv: VolunteerCv): string {
  return `<div dir="rtl" lang="ar" style="width:100%;margin:0 15mm;display:flex;justify-content:space-between;font-family:'Segoe UI',Tahoma,'Noto Sans Arabic',sans-serif;font-size:8px;color:${THEME.light.muted};-webkit-print-color-adjust:exact">
    <span>${escapeHtml(cv.person.name)} · سيرة العمل التطوعي · واثق</span>
    <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
  </div>`;
}

/**
 * The volunteer CV as one A4 HTML page, the look of the web's CvSheet. Puppeteer prints it to
 * PDF. Fonts are Tajawal (body) and Cairo (headings, numbers) from Google Fonts; without
 * internet the PDF falls back to the system's Arabic font.
 */
export function cvPdfHtml(
  cv: VolunteerCv,
  /** Section logo URL → `data:` URI (see `loadSectionLogos`); missing logos are skipped. */
  logos: ReadonlyMap<string, string> = new Map(),
): string {
  const c = THEME.light;
  const p = cv.person;
  const place = [
    p.city,
    p.governorate ? GOVERNORATE_LABELS_AR[p.governorate as Governorate] : '',
  ]
    .filter(Boolean)
    .join('، ');
  const education = [
    p.educationLevel
      ? EDUCATION_LABELS_AR[p.educationLevel as EducationLevel]
      : '',
    p.fieldOfStudy,
  ]
    .filter(Boolean)
    .join(' · ');
  const details = [place, education, p.workField]
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  const badges =
    cv.badges.length === 0
      ? '<p class="empty">لا توجد شارات ممنوحة بعد.</p>'
      : `<ol class="badges">${cv.badges
          .map((b) => {
            const meta = [
              b.event.organizer.name,
              b.event.section.nameAr,
              b.role ? `الدور: ${b.role}` : '',
              b.kind === 'CERTIFICATE' ? 'شهادة حضور' : '',
            ]
              .filter(Boolean)
              .join(' · ');
            const logo = logos.get(b.event.section.logoUrl);
            return `<li${logo ? ' class="with-logo"' : ''}>
              ${logo ? `<img class="logo" src="${logo}" alt="${escapeHtml(b.event.section.nameAr)}">` : ''}
              <div class="row"><strong>${escapeHtml(b.event.title)}</strong><time>${day(b.event.startsAt)}</time></div>
              <p class="meta">${escapeHtml(meta)}</p>
              ${b.description ? `<p class="quote">«${escapeHtml(b.description)}»</p>` : ''}
            </li>`;
          })
          .join('')}</ol>`;

  const impact =
    cv.impact.length > 0
      ? `<section class="keep"><h3>أثر الفعاليات التي شاركت فيها</h3>
          <div class="grid3">${cv.impact.map((m) => stat(m.total, m.label)).join('')}</div></section>`
      : '';

  const teams =
    cv.teams.length > 0
      ? `<section><h3>الفرق</h3><ul class="teams">${cv.teams
          .map(
            (t) =>
              `<li><span><strong>${escapeHtml(t.team.name)}</strong>${
                t.role ? `<em> · ${escapeHtml(t.role)}</em>` : ''
              }</span><time>${yearRange(t.startYear, t.endYear)}</time></li>`,
          )
          .join('')}</ul></section>`
      : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(p.name)} · سيرة العمل التطوعي</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;900&family=Tajawal:wght@500;700;800&display=block">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: ${c.ink}; font-size: 12px; font-weight: 500; }
  h2, h3, .brand, .stat b { font-family: 'Cairo', 'Tajawal', sans-serif; font-weight: 900; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    border-bottom: 2px solid ${c.primary}4D; padding-bottom: 18px; }
  h2 { font-size: 26px; line-height: 1.3; }
  .subtitle { margin-top: 2px; color: ${c.primaryInk}; font-weight: 700; font-size: 13px; }
  .details { margin-top: 8px; color: ${c.muted}; font-weight: 700; font-size: 11px; line-height: 1.7; }
  .issuer { text-align: left; }
  .brand { color: ${c.primaryInk}; font-size: 20px; }
  .issued { color: ${c.muted}; font-weight: 700; font-size: 9px; }
  .bio { margin-top: 18px; color: ${c.inkSoft}; line-height: 2; font-size: 12px; }
  .grid4, .grid3 { display: grid; gap: 10px; text-align: center; }
  .grid4 { grid-template-columns: repeat(4, 1fr); margin-top: 20px; }
  .grid3 { grid-template-columns: repeat(3, 1fr); }
  .stat { background: ${c.icy}; border-radius: 14px; padding: 10px; }
  .stat b { display: block; color: ${c.primaryInk}; font-size: 22px; line-height: 1.4; }
  .stat span { color: ${c.muted}; font-weight: 700; font-size: 10px; }
  section { margin-top: 22px; }
  h3 { font-size: 14px; margin-bottom: 10px; break-after: avoid; page-break-after: avoid; }
  .keep { break-inside: avoid; }
  .badges { list-style: none; }
  .badges li { border: 1px solid ${c.line}; border-radius: 14px; padding: 12px 14px;
    margin-bottom: 9px; break-inside: avoid; }
  .badges li.with-logo { position: relative; padding-inline-start: 58px; }
  .logo { position: absolute; inset-inline-start: 14px; top: 12px; width: 32px; height: 32px; object-fit: contain; }
  .row, .teams li { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .row strong { font-weight: 800; font-size: 13px; }
  time { color: ${c.muted}; font-weight: 700; font-size: 10px; white-space: nowrap; }
  .meta { margin-top: 3px; color: ${c.muted}; font-weight: 700; font-size: 11px; }
  .quote { margin-top: 4px; color: ${c.inkSoft}; line-height: 1.8; font-size: 11px; }
  .empty { color: ${c.muted}; font-weight: 700; font-size: 11px; }
  .teams { list-style: none; }
  .teams li { border-bottom: 1px solid ${c.line}; padding-bottom: 7px; margin-bottom: 7px; break-inside: avoid; }
  .teams li:last-child { border-bottom: 0; margin-bottom: 0; }
  .teams strong { font-weight: 800; font-size: 13px; }
  .teams em { font-style: normal; color: ${c.muted}; font-weight: 700; }
  footer { margin-top: 22px; border-top: 1px solid ${c.line}; padding-top: 12px;
    color: ${c.muted}; font-weight: 700; font-size: 9px; line-height: 1.8; break-inside: avoid; }
</style>
</head>
<body>
  <header>
    <div>
      <h2>${escapeHtml(p.name)}</h2>
      <p class="subtitle">سيرة العمل التطوعي</p>
      ${details ? `<div class="details">${details}</div>` : ''}
    </div>
    <div class="issuer">
      <div class="brand">واثق</div>
      <div class="issued">صادرة في ${day(cv.generatedAt)}</div>
    </div>
  </header>
  ${p.bio ? `<p class="bio">${escapeHtml(p.bio)}</p>` : ''}
  <div class="grid4">
    ${stat(cv.stats.completedEvents, 'فعالية شارك فيها')}
    ${stat(cv.stats.volunteerHours, 'ساعة تطوع')}
    ${stat(cv.stats.approvedBadges, 'شارة وشهادة')}
    ${stat(cv.teams.length, 'فريق')}
  </div>
  <section><h3>المشاركات التطوعية</h3>${badges}</section>
  ${impact}
  ${teams}
  <footer>
    <p>الشارات تمنحها جهات موثّقة على منصة واثق بعد توثيق كل فعالية.</p>
    <p>${HOURS_NOTE}</p>
  </footer>
</body>
</html>`;
}

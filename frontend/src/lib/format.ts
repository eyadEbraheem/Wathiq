// Dates arrive as ISO 8601 UTC; the web shows them in Syria's time zone with Latin digits
// (as in the design reference).

const LOCALE = "ar-SY-u-nu-latn";
const TIME_ZONE = "Asia/Damascus";

/** "الجمعة 5 كانون الأول" */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** "الجمعة 5 كانون الأول • 9:00 ص" */
export function formatDateTime(iso: string): string {
  const time = new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
  return `${formatDay(iso)} • ${time}`;
}

/** "منذ 3 ساعات" style relative time for posts and notifications. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "الآن";
}

/** "ساعة واحدة", "ساعتان", "3 ساعات", "11 ساعة": Arabic number agreement for hours. */
export function formatHours(n: number): string {
  if (n === 1) return "ساعة واحدة";
  if (n === 2) return "ساعتان";
  if (n >= 3 && n <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

/** "جهة واحدة", "جهتان", "3 جهات", "11 جهة": the number of organizations / accounts. */
export function formatAccounts(n: number): string {
  if (n === 0) return "لا جهات";
  if (n === 1) return "جهة واحدة";
  if (n === 2) return "جهتان";
  if (n >= 3 && n <= 10) return `${n} جهات`;
  return `${n} جهة`;
}

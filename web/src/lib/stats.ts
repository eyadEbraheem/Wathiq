import { STATS_PERIODS, type StatsPeriod } from "@csh/shared";

/** The report filters from the page's search params, as the API's query string. */
export function statsQuery(params: { period?: string; governorate?: string; sectionId?: string }): string {
  const q = new URLSearchParams();
  const period = STATS_PERIODS.find((p): p is StatsPeriod => p === params.period) ?? "365d";
  q.set("period", period);
  if (params.governorate && /^[A-Z_]+$/.test(params.governorate)) q.set("governorate", params.governorate);
  if (params.sectionId && /^\d+$/.test(params.sectionId)) q.set("sectionId", params.sectionId);
  return q.toString();
}

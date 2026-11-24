import type { ReactNode } from "react";

/** Numbers with Latin digits and thousands separators, as in the design reference. */
export const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
export const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

/** A big number with its label and the change from the previous window. */
export function KpiTile({
  value,
  label,
  previous,
  hint,
}: {
  value: number;
  label: string;
  previous?: number | null;
  hint?: string;
}) {
  const change =
    previous === undefined || previous === null || previous === 0
      ? null
      : Math.round(((value - previous) / previous) * 100);
  return (
    <div className="rounded-3xl border border-line bg-surface p-4" title={hint}>
      <div className="font-display text-3xl font-black leading-none text-ink">{num(value)}</div>
      <div className="mt-1.5 text-[11px] font-extrabold text-muted">{label}</div>
      {change !== null ? (
        <div
          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
            change >= 0 ? "bg-environment/10 text-environment-ink" : "bg-humanitarian/10 text-humanitarian-ink"
          }`}
        >
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% عن الفترة السابقة
        </div>
      ) : previous === 0 && value > 0 ? (
        <div className="mt-2 inline-flex rounded-full bg-environment/10 px-2 py-0.5 text-[10px] font-black text-environment-ink">
          جديد في هذه الفترة
        </div>
      ) : null}
    </div>
  );
}

export interface BarRow {
  key: string | number;
  label: string;
  value: number;
  /** Text after the bar (defaults to the value). */
  display?: string;
  sub?: string;
  /** Tailwind background class of the bar. */
  tone?: string;
}

/** Horizontal bars, longest first, scaled to the largest value. */
export function BarList({ rows, empty = "لا توجد بيانات بعد." }: { rows: BarRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-xs font-semibold text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="font-extrabold text-ink">{r.label}</span>
            <span className="shrink-0 font-black text-primary-ink">{r.display ?? num(r.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-icy">
            <div
              className={`h-full rounded-full ${r.tone ?? "bg-primary"}`}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          {r.sub ? <div className="mt-0.5 text-[10px] font-semibold text-muted">{r.sub}</div> : null}
        </li>
      ))}
    </ul>
  );
}

const MONTHS_AR = ["كانون ٢", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين ١", "تشرين ٢", "كانون ١"];

/** Completed campaigns per month as columns, with volunteers as a line (SVG, no library). */
export function MonthChart({
  months,
}: {
  months: { month: string; campaigns: number; volunteers: number; hours: number }[];
}) {
  if (months.length === 0) return <p className="text-xs font-semibold text-muted">لا توجد حملات مكتملة في هذه الفترة.</p>;
  const W = 640;
  const H = 200;
  const pad = { top: 16, bottom: 30, side: 8 };
  const step = (W - pad.side * 2) / months.length;
  const maxC = Math.max(...months.map((m) => m.campaigns), 1);
  const maxV = Math.max(...months.map((m) => m.volunteers), 1);
  const y = (v: number, max: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  // Right to left like the page: the latest month on the left.
  const x = (i: number) => W - pad.side - step * (i + 0.5);
  const line = months.map((m, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(m.volunteers, maxV)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="الحملات المكتملة والمتطوعون شهرياً">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.side}
            x2={W - pad.side}
            y1={y(maxC * f, maxC)}
            y2={y(maxC * f, maxC)}
            className="stroke-line"
            strokeDasharray="3 4"
          />
        ))}
        {months.map((m, i) => {
          const top = y(m.campaigns, maxC);
          const [year, mo] = m.month.split("-");
          return (
            <g key={m.month}>
              <rect
                x={x(i) - step * 0.32}
                y={top}
                width={step * 0.64}
                height={H - pad.bottom - top}
                rx={4}
                className="fill-primary/70"
              >
                <title>{`${m.month}: ${m.campaigns} حملة، ${m.volunteers} متطوع، ${m.hours} ساعة`}</title>
              </rect>
              {m.campaigns > 0 ? (
                <text x={x(i)} y={top - 4} textAnchor="middle" className="fill-ink text-[10px] font-black">
                  {m.campaigns}
                </text>
              ) : null}
              {months.length <= 14 || i % 2 === 0 ? (
                <text x={x(i)} y={H - 14} textAnchor="middle" className="fill-muted text-[9px] font-bold">
                  {MONTHS_AR[Number(mo) - 1]}
                </text>
              ) : null}
              {mo === "01" || i === 0 || i === months.length - 1 ? (
                <text x={x(i)} y={H - 3} textAnchor="middle" className="fill-muted text-[8px]">
                  {year}
                </text>
              ) : null}
            </g>
          );
        })}
        <path d={line} fill="none" className="stroke-community" strokeWidth={2.5} strokeLinejoin="round" />
        {months.map((m, i) => (
          <circle key={m.month} cx={x(i)} cy={y(m.volunteers, maxV)} r={3} className="fill-community" />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-[11px] font-bold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary/70" /> حملات مكتملة
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-community" /> متطوعون شاركوا
        </span>
      </figcaption>
    </figure>
  );
}

/** Stars 1–5 as a small distribution. */
export function RatingBars({ distribution }: { distribution: number[] }) {
  const total = distribution.reduce((a, b) => a + b, 0) || 1;
  return (
    <ul className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((s) => (
        <li key={s} className="flex items-center gap-2 text-[11px] font-bold text-muted">
          <span className="w-8 shrink-0 text-ink">{s} ★</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-icy">
            <span
              className="block h-full rounded-full bg-community"
              style={{ width: `${(distribution[s - 1] / total) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-left">{num(distribution[s - 1])}</span>
        </li>
      ))}
    </ul>
  );
}

/** A titled card of the report. */
export function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-display text-sm font-black text-ink">{title}</h2>
      {hint ? <p className="mt-0.5 text-[11px] font-semibold leading-5 text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

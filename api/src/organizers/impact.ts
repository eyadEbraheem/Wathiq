/**
 * Sums impact metrics per normalized label. Pass rows newest first: the newest spelling of a
 * label is the one shown. Biggest totals first.
 */
export function sumImpact(
  rows: { label: string; normalized: string; value: number }[],
): { label: string; total: number }[] {
  const byLabel = new Map<string, { label: string; total: number }>();
  for (const row of rows) {
    const seen = byLabel.get(row.normalized);
    if (seen) seen.total += row.value;
    else byLabel.set(row.normalized, { label: row.label, total: row.value });
  }
  return [...byLabel.values()].sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label),
  );
}

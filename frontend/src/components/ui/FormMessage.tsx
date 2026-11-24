/** Error or success line under a form. Announced to screen readers. */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-humanitarian/25 bg-humanitarian/10 px-4 py-2.5 text-xs font-extrabold text-humanitarian-ink"
      >
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-environment/25 bg-environment/10 px-4 py-2.5 text-xs font-extrabold text-environment-ink"
      >
        {notice}
      </p>
    );
  }
  return null;
}

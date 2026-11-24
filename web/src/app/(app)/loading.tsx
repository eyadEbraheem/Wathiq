export default function Loading() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="جارٍ التحميل">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-card border border-line bg-surface" />
      ))}
    </div>
  );
}

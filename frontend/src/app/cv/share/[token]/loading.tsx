export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-10 w-64 animate-pulse rounded-2xl bg-surface" />
      <div className="mx-auto h-[70vh] max-w-[210mm] animate-pulse rounded-card border border-line bg-surface" />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvSheet } from "@/components/cv/CvSheet";
import { PrintButton } from "@/components/cv/PrintButton";
import { apiFetch } from "@/lib/api";
import { formatDay } from "@/lib/format";
import type { VolunteerCv } from "@/lib/types";

// A personal page reached only through its secret link: keep it out of search engines.
export const metadata: Metadata = {
  title: "سيرة تطوعية · واثق",
  robots: { index: false, follow: false },
};

/**
 * Public page behind a shared CV link (the QR opens it). No sign-in. The data is fetched on
 * every visit, so it always shows the CV as it is now.
 */
export default async function SharedCvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await apiFetch(`/cv/public/${encodeURIComponent(token)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Shared CV failed with ${res.status}`);
  const cv = (await res.json()) as VolunteerCv;

  return (
    <div className="view-pop space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-black text-ink">سيرة تطوعية على واثق</h1>
          <p className="text-xs font-semibold text-muted">
            معلومات محدّثة لحظة فتح الصفحة ({formatDay(cv.generatedAt)}).
          </p>
        </div>
        <PrintButton />
      </div>

      <CvSheet
        cv={cv}
        footerNote="هذه نسخة شاركها صاحبها عبر رابط من منصة واثق، وتعرض بياناته الحالية على المنصة."
      />
    </div>
  );
}

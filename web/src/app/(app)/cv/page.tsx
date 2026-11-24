import { redirect } from "next/navigation";
import type { CvShare } from "@csh/shared";
import { CvSheet } from "@/components/cv/CvSheet";
import { DownloadCvButton } from "@/components/cv/DownloadCvButton";
import { isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { cvQrContent, cvShareUrl, qrSvg } from "@/lib/cv-share";
import { requireSessionToken } from "@/lib/session";
import type { VolunteerCv } from "@/lib/types";
import { CvShareCard } from "./CvShareCard";

export const metadata = { title: "سيرتي التطوعية · واثق" };

/**
 * The volunteer CV as an A4 page. "تحميل PDF" downloads a real PDF file made by the API
 * (/cv/pdf). Printing still works too: only the sheet shows (the shell and the share card hide
 * themselves with `print:hidden`). Above it, the owner can share it through a public link and
 * its QR.
 */
export default async function CvPage() {
  const token = await requireSessionToken();
  // Badges and the volunteer CV are for people; organizations do not volunteer.
  if (isOrganization(await fetchCurrentUser(token))) redirect("/me");
  const [cvRes, shareRes] = await Promise.all([
    apiFetch("/users/me/cv", { token }),
    apiFetch("/users/me/cv/share", { token }),
  ]);
  if (!cvRes.ok) throw new Error(`CV failed with ${cvRes.status}`);
  if (!shareRes.ok) throw new Error(`CV share failed with ${shareRes.status}`);
  const cv = (await cvRes.json()) as VolunteerCv;
  const share = (await shareRes.json()) as CvShare;

  const url = share.token ? cvShareUrl(share.token) : null;
  const shared = url
    ? { url, qrSvg: await qrSvg(cvQrContent(url, share.offline)), offline: share.offline !== null }
    : null;

  return (
    <div className="view-pop space-y-5 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-xl font-black text-ink">سيرتي التطوعية</h1>
          <p className="text-xs font-semibold text-muted">
            «تحميل PDF» يحفظ ملف السيرة على جهازك. الشارات المخفية من ملفك لا تظهر هنا.
          </p>
        </div>
        <DownloadCvButton />
      </div>

      <CvShareCard share={shared} />

      <CvSheet cv={cv} />
    </div>
  );
}

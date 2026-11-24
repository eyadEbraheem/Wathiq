"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Icon } from "@/components/ui/Icon";
import type { FormState } from "@/lib/actions/auth";
import { disableCvShareAction, enableCvShareAction } from "@/lib/actions/cv";

/**
 * Sharing the CV: a public link and its QR. Whoever opens it sees the CV as it is at that
 * moment (no sign-in needed). A new link replaces the old one; stopping turns it off.
 */
export function CvShareCard({
  share,
}: {
  /** `offline`: the QR also holds a signed copy the Wathiq app shows without internet. */
  share: { url: string; qrSvg: string; offline: boolean } | null;
}) {
  const [enableState, enable, enabling] = useActionState<FormState, FormData>(
    enableCvShareAction,
    {},
  );
  const [disableState, disable, disabling] = useActionState<FormState>(disableCvShareAction, {});
  const [copied, setCopied] = useState(false);
  // Show the message of the form submitted last only.
  const [last, setLast] = useState<"enable" | "disable" | null>(null);
  const busy = enabling || disabling;
  const message = last === "enable" ? enableState : last === "disable" ? disableState : {};

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="mx-auto max-w-[210mm] space-y-4 p-6 print:hidden">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-icy text-primary-ink">
          <Icon name="qr" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-black text-ink">مشاركة سيرتي</h2>
          <p className="mt-0.5 text-xs font-semibold leading-6 text-muted">
            من يمسح الرمز أو يفتح الرابط يرى سيرتك بمعلوماتها الحالية لحظة الفتح، دون حساب: الشارات والساعات والأثر، ومن معلوماتك الشخصية ما اخترت إظهاره في الخصوصية فقط.
            {share?.offline
              ? "بلا إنترنت، يعرض تطبيق واثق نسخة موقّعة محفوظة في الرمز نفسه، بتاريخ إنشاء الرمز."
              : "يحتاج ذلك اتصالاً بالإنترنت."}
          </p>
        </div>
      </div>

      <FormMessage error={message.error} notice={message.notice} />

      {share ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            // A code with the offline copy is denser, so it gets more room to stay scannable.
            className={`mx-auto shrink-0 rounded-2xl border border-line bg-white p-2 sm:mx-0 ${share.offline ? "w-64" : "w-44"}`}
            role="img"
            aria-label="رمز QR لرابط السيرة"
            // Trusted markup: generated on our server by the qrcode library from our own URL.
            dangerouslySetInnerHTML={{ __html: share.qrSvg }}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] font-bold text-ink"
                title={share.url}
              >
                {share.url}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={() => copy(share.url)}>
                <Icon name={copied ? "check" : "link"} className="h-3.5 w-3.5" />
                {copied ? "نُسخ" : "نسخ"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={enable} onSubmit={() => setLast("enable")}>
                <input type="hidden" name="renew" value="1" />
                <Button type="submit" size="sm" variant="secondary" disabled={busy}>
                  {enabling ? "جارٍ الإنشاء…" : "رابط جديد"}
                </Button>
              </form>
              <form action={disable} onSubmit={() => setLast("disable")}>
                <Button type="submit" size="sm" variant="ghost" disabled={busy}>
                  {disabling ? "جارٍ الإيقاف…" : "إيقاف المشاركة"}
                </Button>
              </form>
            </div>
            <p className="text-[11px] font-semibold text-muted">
              «رابط جديد» يوقف الرابط القديم وكل رمز طُبع منه.
            </p>
          </div>
        </div>
      ) : (
        <form action={enable} onSubmit={() => setLast("enable")}>
          <Button type="submit" disabled={busy}>
            <Icon name="qr" className="h-4 w-4" />
            {enabling ? "جارٍ الإنشاء…" : "إنشاء رابط ورمز QR"}
          </Button>
        </form>
      )}
    </Card>
  );
}

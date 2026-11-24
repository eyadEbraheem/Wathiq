"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Icon } from "@/components/ui/Icon";

/** The Arabic file name from `filename*=UTF-8''…`, or the plain one. */
function fileName(disposition: string | null): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the plain name.
    }
  }
  return disposition?.match(/filename="([^"]+)"/i)?.[1] ?? "wathiq-cv.pdf";
}

/**
 * Downloads the CV as a real PDF file (made by the API), saved straight to the device's
 * downloads on a laptop or a phone. No print dialog.
 */
export function DownloadCvButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/cv/pdf", { cache: "no-store" });
      // The session ended: the route sent us to the login page.
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(res.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to start the download before freeing the file.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("تعذّر تجهيز ملف السيرة. حاول مرة أخرى بعد قليل.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 print:hidden">
      <Button type="button" onClick={download} disabled={pending} aria-busy={pending}>
        <Icon name="arrow" className="h-4 w-4 -rotate-90" />
        {pending ? "جارٍ تجهيز الملف…" : "تحميل PDF"}
      </Button>
      <FormMessage error={error ?? undefined} />
    </div>
  );
}

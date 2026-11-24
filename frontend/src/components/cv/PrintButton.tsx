"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Opens the browser's print dialog, where "Save as PDF" makes the file (no PDF library). */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Icon name="arrow" className="h-4 w-4 -rotate-90" />
      تحميل PDF
    </Button>
  );
}

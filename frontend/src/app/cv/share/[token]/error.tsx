"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SharedCvError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="view-pop mx-auto mt-10 max-w-md p-10 text-center">
      <h1 className="font-display text-xl font-black text-ink">تعذّر عرض السيرة</h1>
      <p className="mt-2 text-sm font-semibold text-muted">
        يحتاج عرض السيرة اتصالاً بالإنترنت. تأكد من الاتصال ثم حاول مرة أخرى.
      </p>
      <Button onClick={reset} className="mt-6">
        حاول مرة أخرى
      </Button>
    </Card>
  );
}

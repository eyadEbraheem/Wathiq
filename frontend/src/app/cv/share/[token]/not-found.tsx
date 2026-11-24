import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SharedCvNotFound() {
  return (
    <Card className="view-pop mx-auto mt-10 max-w-md p-10 text-center">
      <p className="font-display text-5xl font-black text-primary-ink">404</p>
      <h1 className="mt-3 font-display text-xl font-black text-ink">رابط السيرة غير متاح</h1>
      <p className="mt-2 text-sm font-semibold text-muted">
        ربما أوقف صاحب السيرة مشاركتها أو أنشأ رابطاً جديداً، أو أن الرابط غير صحيح.
      </p>
      <ButtonLink href="/" className="mt-6">
        العودة للرئيسية
      </ButtonLink>
    </Card>
  );
}

"use client";

import { useActionState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { requestResetCodeAction, resetPasswordAction, type ResetState } from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: ResetState = {};

/**
 * Step 2 of a password reset: the emailed code + the new password twice. Used on
 * /reset-password and in the account settings. On success the user signs in again.
 * `own`: the signed-in user's own address (the code was surely sent), so no "if an account exists".
 */
export function ResetCodeStep({ email, own = false }: { email: string; own?: boolean }) {
  const [reset, resetAction, resetting] = useActionState(resetPasswordAction, initialState);
  const [resend, resendAction, resending] = useActionState(requestResetCodeAction, initialState);

  return (
    <>
      <div className="text-center">
        <span className="rounded-full bg-icy px-3.5 py-1 text-[11px] font-black text-primary-ink">تحقق آمن</span>
        <h2 className="mt-2 font-display text-xl font-black text-ink">اختر كلمة مرور جديدة</h2>
        <p className="mt-1 text-xs font-semibold leading-6 text-muted">
          {own ? (
            <>
              أرسلنا 6 أرقام إلى <span dir="ltr" className="font-black">{email}</span>، صالحة لمدة 10 دقائق.
            </>
          ) : (
            <>
              إذا كان هناك حساب بالبريد <span dir="ltr" className="font-black">{email}</span>، فقد أرسلنا
              إليه 6 أرقام صالحة لمدة 10 دقائق.
            </>
          )}
        </p>
      </div>
      <form action={resetAction} onSubmit={keepValuesOnSubmit(resetAction)} className="space-y-4">
        <FormMessage error={reset.error ?? resend.error} notice={resend.notice} />
        <input type="hidden" name="email" value={email} />
        <OtpInput />
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label="كلمة المرور الجديدة"
          hint="8 أحرف على الأقل."
          autoComplete="new-password"
          dir="ltr"
          required
          minLength={8}
          maxLength={72}
        />
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="تأكيد كلمة المرور"
          autoComplete="new-password"
          dir="ltr"
          required
          minLength={8}
          maxLength={72}
        />
        <Button type="submit" disabled={resetting} className="w-full">
          {resetting ? "جارٍ الحفظ…" : "احفظ كلمة المرور ←"}
        </Button>
        <p className="text-center text-[11px] font-semibold text-muted">
          سيتم تسجيل خروجك من كل الأجهزة بعد التغيير.
        </p>
      </form>
      <form action={resendAction} className="mt-3 text-center">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="again" value="1" />
        <Button type="submit" variant="ghost" size="sm" disabled={resending}>
          لم يصلك الرمز؟ أرسل رمزاً جديداً
        </Button>
      </form>
    </>
  );
}

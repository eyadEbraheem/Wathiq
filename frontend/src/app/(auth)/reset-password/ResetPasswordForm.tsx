"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ResetCodeStep } from "@/components/auth/ResetCodeStep";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { requestResetCodeAction, type ResetState } from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: ResetState = {};

/** Step 1: the email → the API sends a code. Step 2: the code + a new password. */
export function ResetPasswordForm() {
  const [request, requestAction, requesting] = useActionState(requestResetCodeAction, initialState);

  if (request.email) return <ResetCodeStep email={request.email} />;

  return (
    <>
      <div>
        <h2 className="font-display text-xl font-black text-ink">إعادة تعيين كلمة المرور</h2>
        <p className="mt-0.5 text-xs font-semibold text-muted">
          أدخل بريد حسابك، وسنرسل لك رمزاً لتختار كلمة مرور جديدة.
        </p>
      </div>
      <form action={requestAction} onSubmit={keepValuesOnSubmit(requestAction)} className="space-y-4">
        <FormMessage error={request.error} />
        <Input
          id="email"
          name="email"
          type="email"
          label="البريد الإلكتروني"
          autoComplete="email"
          dir="ltr"
          required
        />
        <Button type="submit" disabled={requesting} className="w-full">
          {requesting ? "جارٍ الإرسال…" : "أرسل الرمز ←"}
        </Button>
        <p className="text-center text-xs font-semibold text-muted">
          تذكّرت كلمة المرور؟{" "}
          <Link href="/login" className="font-black text-primary-ink hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </form>
    </>
  );
}

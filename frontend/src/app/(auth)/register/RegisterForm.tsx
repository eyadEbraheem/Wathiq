"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  resendCodeAction,
  signupAction,
  verifySignupAction,
  type FormState,
  type SignupState,
} from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialSignup: SignupState = {};
const initialForm: FormState = {};

/** Step 1: details → the API sends a code. Step 2: the code → the account is created. */
export function RegisterForm() {
  const [signup, signupFormAction, signingUp] = useActionState(signupAction, initialSignup);
  const [kind, setKind] = useState<"PERSON" | "ORGANIZATION">("PERSON");
  const organization = kind === "ORGANIZATION";

  if (signup.signupId && signup.email) {
    return <CodeStep signupId={signup.signupId} email={signup.email} />;
  }

  return (
    <>
      <div>
        <h2 className="font-display text-xl font-black text-ink">
          {organization ? "تسجيل جمعية أو فريق" : "إنشاء حساب متطوع جديد"}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-muted">
          {organization
            ? "بعد تأكيد البريد ترفعون أوراق الجمعية. يبقى الحساب للتصفح فقط حتى يوافق فريق واثق على التوثيق."
            : "أدخل بياناتك الأساسية، وسنرسل لك رمز تأكيد على بريدك."}
        </p>
      </div>
      <form action={signupFormAction} onSubmit={keepValuesOnSubmit(signupFormAction)} className="space-y-4">
        <FormMessage error={signup.error} />
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-xs font-black text-ink">التسجيل كـ</legend>
          {(
            [
              ["PERSON", "فرد", "متطوع أو ناشط"],
              ["ORGANIZATION", "جمعية أو فريق", "يحتاج توثيقاً قبل التفعيل"],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`organic cursor-pointer border-2 p-3 text-right ${
                kind === value ? "flipped border-primary bg-icy" : "border-line bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="accountKind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span className="block text-sm font-black text-ink">{label}</span>
              <span className="block text-[11px] font-semibold text-muted">{hint}</span>
            </label>
          ))}
        </fieldset>
        <Input
          id="name"
          name="name"
          label={organization ? "اسم الجمعية أو الفريق" : "الاسم الكامل"}
          autoComplete={organization ? "organization" : "name"}
          required
          minLength={2}
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="البريد الإلكتروني"
          autoComplete="email"
          dir="ltr"
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="password"
            name="password"
            type="password"
            label="كلمة المرور"
            hint="8 أحرف على الأقل."
            autoComplete="new-password"
            dir="ltr"
            required
            minLength={8}
          />
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            label={organization ? "تاريخ التأسيس" : "تاريخ الميلاد"}
            hint={organization ? "يظهر عام التأسيس في صفحة الجمعية." : "13 سنة أو أكثر. لا يظهر لأحد."}
            required
          />
        </div>
        <Button type="submit" disabled={signingUp} className="w-full">
          {signingUp ? "جارٍ الإرسال…" : "أرسل رمز التأكيد ←"}
        </Button>
        <p className="text-center text-xs font-semibold text-muted">
          لديك حساب؟{" "}
          <Link href="/login" className="font-black text-primary-ink hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </form>
    </>
  );
}

function CodeStep({ signupId, email }: { signupId: number; email: string }) {
  const [verify, verifyAction, verifying] = useActionState(verifySignupAction, initialForm);
  const [resend, resendAction, resending] = useActionState(resendCodeAction, initialForm);

  return (
    <>
      <div className="text-center">
        <span className="rounded-full bg-icy px-3.5 py-1 text-[11px] font-black text-primary-ink">تحقق آمن</span>
        <h2 className="mt-2 font-display text-xl font-black text-ink">أدخل رمز التأكيد</h2>
        <p className="mt-1 text-xs font-semibold leading-6 text-muted">
          أرسلنا 6 أرقام إلى <span dir="ltr" className="font-black">{email}</span>. صالحة لمدة 10 دقائق.
        </p>
      </div>
      <form action={verifyAction} onSubmit={keepValuesOnSubmit(verifyAction)} className="space-y-5">
        <FormMessage error={verify.error ?? resend.error} notice={resend.notice} />
        <input type="hidden" name="signupId" value={signupId} />
        <OtpInput />
        <Button type="submit" disabled={verifying} className="w-full">
          {verifying ? "جارٍ التحقق…" : "تأكيد الحساب ←"}
        </Button>
      </form>
      <form action={resendAction} className="mt-3 text-center">
        <input type="hidden" name="signupId" value={signupId} />
        <Button type="submit" variant="ghost" size="sm" disabled={resending}>
          لم يصلك الرمز؟ أرسل رمزاً جديداً
        </Button>
      </form>
    </>
  );
}

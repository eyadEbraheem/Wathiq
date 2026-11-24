"use client";

import { useActionState, useState } from "react";
import { ResetCodeStep } from "@/components/auth/ResetCodeStep";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import {
  changePasswordAction,
  sendMyResetCodeAction,
  type FormState,
  type ResetState,
} from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";
import type { CurrentUser } from "@/lib/types";

const initialForm: FormState = {};
const initialReset: ResetState = {};

/** Account & privacy: the sign-in contacts, and changing the password (or resetting it by code). */
export function AccountForm({ user }: { user: CurrentUser }) {
  const [forgot, setForgot] = useState(false);

  return (
    <div className="mt-4 space-y-5">
      <dl className="divide-y divide-line rounded-2xl border border-line bg-canvas">
        <ContactRow label="البريد الإلكتروني" value={user.email} />
        <ContactRow label="رقم الهاتف" value={user.phone} />
      </dl>

      <div className="space-y-3">
        <h3 className="font-display text-base font-black text-ink">
          {forgot ? "استعادة كلمة المرور برمز" : "تغيير كلمة المرور"}
        </h3>
        {forgot ? <ForgotByCode onBack={() => setForgot(false)} /> : <ChangePassword onForgot={() => setForgot(true)} />}
      </div>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className={`text-sm font-black ${value ? "text-ink" : "text-muted"}`} dir={value ? "ltr" : undefined}>
        {value ?? "غير مضاف"}
      </dd>
    </div>
  );
}

function ChangePassword({ onForgot }: { onForgot: () => void }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialForm);

  return (
    <form
      action={formAction}
      // After a success the fields are emptied; on an error they keep what was typed.
      onSubmit={keepValuesOnSubmit(formAction)}
      key={state.notice}
      className="space-y-4"
    >
      <FormMessage error={state.error} notice={state.notice} />
      <Input
        id="currentPassword"
        name="currentPassword"
        type="password"
        label="كلمة المرور الحالية"
        autoComplete="current-password"
        dir="ltr"
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          label="تأكيد كلمة المرور الجديدة"
          autoComplete="new-password"
          dir="ltr"
          required
          minLength={8}
          maxLength={72}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
        </Button>
        <button type="button" onClick={onForgot} className="text-xs font-extrabold text-primary-ink hover:underline">
          هل نسيت كلمة المرور؟
        </button>
      </div>
    </form>
  );
}

/** Sends a code to the user's own email, then the same code step as /reset-password. */
function ForgotByCode({ onBack }: { onBack: () => void }) {
  const [sent, sendAction, sending] = useActionState(sendMyResetCodeAction, initialReset);

  return (
    <div className="space-y-4">
      {sent.email ? (
        <ResetCodeStep email={sent.email} own />
      ) : (
        <form action={sendAction} className="space-y-3">
          <FormMessage error={sent.error} />
          <p className="text-xs font-semibold leading-6 text-muted">
            سنرسل رمزاً من 6 أرقام إلى بريدك، ثم تختار كلمة مرور جديدة. بعد التغيير يتم تسجيل خروجك من
            كل الأجهزة، فتسجّل الدخول من جديد بالكلمة الجديدة.
          </p>
          <Button type="submit" variant="secondary" disabled={sending}>
            {sending ? "جارٍ الإرسال…" : "أرسل الرمز إلى بريدي"}
          </Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="text-xs font-extrabold text-primary-ink hover:underline">
        تذكّرتها؟ غيّرها بكلمة المرور الحالية
      </button>
    </div>
  );
}

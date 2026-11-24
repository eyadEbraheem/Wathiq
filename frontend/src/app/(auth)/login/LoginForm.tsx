"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { loginAction, type FormState } from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: FormState = {};

/** `notice`: a success line from the previous step (e.g. after a password reset). */
export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="space-y-4">
      <FormMessage error={state.error} notice={state.error ? undefined : notice} />
      <Input
        id="identifier"
        name="identifier"
        type="email"
        label="البريد الإلكتروني"
        autoComplete="email"
        dir="ltr"
        required
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="كلمة المرور"
        autoComplete="current-password"
        dir="ltr"
        required
      />
      <div className="-mt-2">
        <Link href="/reset-password" className="text-xs font-extrabold text-primary-ink hover:underline">
          إعادة تعيين كلمة المرور
        </Link>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "جارٍ الدخول…" : "دخول"}
      </Button>
      <p className="text-center text-xs font-semibold text-muted">
        ليس لديك حساب؟{" "}
        <Link href="/register" className="font-black text-primary-ink hover:underline">
          أنشئ حساباً
        </Link>
      </p>
    </form>
  );
}

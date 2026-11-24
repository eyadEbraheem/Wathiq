"use client";

import { useActionState } from "react";
import { choose } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import {
  addBannedWordAction,
  decidePlatformRequestAction,
  decideReportAction,
  decideVerificationAction,
  suspendUserAction,
} from "@/lib/actions/admin";
import { keepValuesOnSubmit } from "@/lib/forms";

const primary =
  "organic organic-sm bg-teal-grad px-4 py-2 text-xs font-black text-white shadow-glow disabled:opacity-60";
const quiet =
  "organic organic-sm border border-line bg-canvas px-4 py-2 text-xs font-extrabold text-muted hover:text-humanitarian-ink disabled:opacity-60";

export function VerificationDecision({ id }: { id: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideVerificationAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="id" value={id} />
      <input name="reason" maxLength={500} placeholder="سبب الرفض (مطلوب عند الرفض)" aria-label="سبب الرفض" className={`h-10 ${controlClasses}`} />
      <div className="flex gap-2">
        <button type="submit" onClick={choose("approve")} disabled={pending} className={primary}>
          توثيق الحساب
        </button>
        <button type="submit" onClick={choose("reject")} disabled={pending} className={quiet}>
          رفض
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

export function ReportDecision({ id, canHide }: { id: number; canHide: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideReportAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-4 text-xs font-bold text-ink">
        {canHide ? (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="hideContent" className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
            إخفاء المحتوى
          </label>
        ) : null}
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="suspendUser" className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
          إيقاف صاحبه
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" onClick={choose("resolve")} disabled={pending} className={primary}>
          معالجة
        </button>
        <button type="submit" onClick={choose("dismiss")} disabled={pending} className={quiet}>
          لا مشكلة (تجاهل)
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

export function PlatformDecision({ id }: { id: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decidePlatformRequestAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="id" value={id} />
      <input name="reason" maxLength={500} placeholder="سبب الرفض (اختياري)" aria-label="سبب الرفض" className={`h-10 ${controlClasses}`} />
      <div className="flex gap-2">
        <button type="submit" onClick={choose("approve")} disabled={pending} className={primary}>
          نشر
        </button>
        <button type="submit" onClick={choose("reject")} disabled={pending} className={quiet}>
          رفض
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

export function SuspendForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(suspendUserAction, {});
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-ink">رقم الحساب</span>
        <input name="userId" type="number" min={1} required className={`h-11 ${controlClasses}`} />
      </label>
      <div className="flex gap-2">
        <button type="submit" onClick={choose("suspend")} disabled={pending} className={primary}>
          إيقاف
        </button>
        <button type="submit" onClick={choose("unsuspend")} disabled={pending} className={quiet}>
          رفع الإيقاف
        </button>
      </div>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}

export function BannedWordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addBannedWordAction, {});
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <div className="flex gap-2">
        <input name="word" required maxLength={60} placeholder="كلمة أو عبارة" aria-label="كلمة ممنوعة" className={`h-11 ${controlClasses}`} />
        <button type="submit" disabled={pending} className={`${primary} shrink-0`}>
          إضافة
        </button>
      </div>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}

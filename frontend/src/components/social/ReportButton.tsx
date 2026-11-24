"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import { reportAction } from "@/lib/actions/social";
import { keepValuesOnSubmit } from "@/lib/forms";

const REASONS = [
  ["FRAUD", "احتيال"],
  ["OFFENSIVE", "محتوى مسيء"],
  ["MISLEADING", "معلومات خاطئة"],
  ["SPAM", "رسائل مزعجة"],
  ["OTHER", "سبب آخر"],
] as const;

/** A small fold-out "report" form for a post, a comment or an account. */
export function ReportButton({
  target,
  targetId,
  label = "إبلاغ",
}: {
  target: "POST" | "COMMENT" | "USER";
  targetId: number;
  label?: string;
}) {
  const [state, action, pending] = useActionState(reportAction, {});
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none text-[11px] font-bold text-muted hover:text-humanitarian-ink [&::-webkit-details-marker]:hidden">
        ⚑ {label}
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-72 rounded-3xl border border-line bg-surface p-4 shadow-soft-hover">
        {state.notice ? (
          <FormMessage notice={state.notice} />
        ) : (
          <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2.5">
            <input type="hidden" name="target" value={target} />
            <input type="hidden" name="targetId" value={targetId} />
            <p className="text-xs font-black text-ink">لماذا تبلّغ عن هذا؟</p>
            <select name="reason" required defaultValue="" aria-label="سبب البلاغ" className={`h-10 ${controlClasses}`}>
              <option value="" disabled>
                اختر السبب…
              </option>
              {REASONS.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <textarea
              name="details"
              maxLength={1000}
              rows={2}
              placeholder="تفاصيل تساعد المراجعة (اختياري)"
              aria-label="تفاصيل"
              className={`py-2 leading-6 ${controlClasses}`}
            />
            <FormMessage error={state.error} />
            <button
              type="submit"
              disabled={pending}
              className="organic organic-sm w-full border border-humanitarian/40 bg-humanitarian/10 py-2 text-xs font-black text-humanitarian-ink disabled:opacity-60"
            >
              {pending ? "جارٍ الإرسال…" : "إرسال البلاغ"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

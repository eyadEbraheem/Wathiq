"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { controlClasses } from "@/components/ui/Input";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FormState } from "@/lib/actions/auth";
import { applyToEventAction } from "@/lib/actions/events";
import type { EventQuestion, EventRoleView } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

/**
 * Applying to an event: up to three ranked roles (when the event has roles), the organizer's
 * questions and an optional message.
 */
export function ApplyForm({
  eventId,
  roles,
  questions,
}: {
  eventId: number;
  roles: EventRoleView[];
  questions: EventQuestion[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyToEventAction, {});
  const open = roles.filter((r) => r.seatsLeft > 0);

  if (state.notice) return <FormMessage notice={state.notice} />;

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-3.5">
      <input type="hidden" name="eventId" value={eventId} />

      {roles.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-black text-ink">
            الأدوار التي تفضّلها (اختر من 1 إلى 3 بالترتيب)
          </legend>
          {[1, 2, 3].map((rank) => (
            <select
              key={rank}
              name={`role${rank}`}
              required={rank === 1}
              defaultValue=""
              aria-label={`الاختيار ${rank}`}
              className={`h-11 ${controlClasses}`}
            >
              <option value="">{rank === 1 ? "الاختيار الأول" : `الاختيار ${rank === 2 ? "الثاني" : "الثالث"} (اختياري)`}</option>
              {open.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · باقي {r.seatsLeft}
                </option>
              ))}
            </select>
          ))}
        </fieldset>
      ) : null}

      {questions.map((q) => (
        <label key={q.id} className="block">
          <span className="mb-1.5 block text-xs font-black text-ink">
            {q.text}
            {q.required ? <span className="text-humanitarian-ink"> *</span> : null}
          </span>
          <textarea
            name={`answer:${q.id}`}
            required={q.required}
            maxLength={1000}
            rows={2}
            className={`py-2.5 leading-7 ${controlClasses}`}
          />
        </label>
      ))}

      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-ink">رسالة للمنظّم (اختياري)</span>
        <textarea
          name="message"
          maxLength={1000}
          rows={2}
          placeholder="متى تكون متفرّغاً، أو أي خبرة تفيد الفريق…"
          className={`py-2.5 leading-7 ${controlClasses}`}
        />
      </label>

      <FormMessage error={state.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "أرسل طلب التطوع"}
      </Button>
    </form>
  );
}

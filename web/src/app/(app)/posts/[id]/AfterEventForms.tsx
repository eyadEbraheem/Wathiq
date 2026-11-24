"use client";

import { useActionState } from "react";
import { choose } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FormState } from "@/lib/actions/auth";
import { rateOrganizerAction, requestBadgeAction } from "@/lib/actions/events";
import { keepValuesOnSubmit } from "@/lib/forms";

/** "Request my badge" for an accepted volunteer of a documented event. */
export function RequestBadgeForm({
  applicationId,
  eventId,
  certificate,
}: {
  applicationId: number;
  eventId: number;
  certificate: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestBadgeAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="eventId" value={eventId} />
      <FormMessage error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="organic flex w-full items-center justify-center bg-teal-grad py-3 text-sm font-black text-white shadow-glow disabled:opacity-60"
      >
        {certificate ? "اطلب شهادة الحضور" : "اطلب شارتك"}
      </button>
    </form>
  );
}

/** 1 to 5 stars for the organizer, no text. */
export function RateForm({
  applicationId,
  eventId,
  current,
}: {
  applicationId: number;
  eventId: number;
  current: number | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(rateOrganizerAction, {});
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="stars" defaultValue="" />
      <p className="text-xs font-black text-ink">
        {current ? `قيّمت المنظّم بـ ${current} من 5. يمكنك تغيير تقييمك:` : "كيف كانت تجربتك مع المنظّم؟"}
      </p>
      <div className="flex gap-1.5" role="group" aria-label="عدد النجوم">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="submit"
            onClick={choose(String(n), "stars")}
            disabled={pending}
            aria-label={`${n} من 5`}
            className={`organic organic-sm h-10 w-10 text-lg font-black disabled:opacity-60 ${
              current && n <= current ? "bg-community text-white" : "bg-canvas text-community"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-muted">
        لا يرى الناس إلا المعدّل، ويرى المنظّم من قيّمه. يمكن التعديل خلال 30 يوماً من التوثيق.
      </p>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}

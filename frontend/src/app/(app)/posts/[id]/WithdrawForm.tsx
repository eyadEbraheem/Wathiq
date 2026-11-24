"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FormState } from "@/lib/actions/auth";
import { withdrawApplicationAction } from "@/lib/actions/events";
import { keepValuesOnSubmit } from "@/lib/forms";

/** Lets the volunteer withdraw before the application deadline. */
export function WithdrawForm({ applicationId, eventId }: { applicationId: number; eventId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    withdrawApplicationAction,
    {},
  );
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="eventId" value={eventId} />
      <FormMessage error={state.error} notice={state.notice} />
      <button
        type="submit"
        disabled={pending}
        className="organic organic-sm w-full border border-line bg-canvas py-2.5 text-xs font-extrabold text-muted hover:border-humanitarian/50 hover:text-humanitarian-ink disabled:opacity-60"
      >
        {pending ? "جارٍ السحب…" : "سحب طلبي"}
      </button>
    </form>
  );
}

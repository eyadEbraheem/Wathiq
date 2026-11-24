"use client";

import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { Icon } from "@/components/ui/Icon";
import type { FormState } from "@/lib/actions/auth";
import { updateAvatarAction } from "@/lib/actions/users";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: FormState = {};

/** Change / remove the profile photo. Picking a file sends the form right away. */
export function AvatarForm({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, formAction, pending] = useActionState(updateAvatarAction, initialState);
  const form = useRef<HTMLFormElement>(null);
  const remove = useRef<HTMLInputElement>(null);

  return (
    <form ref={form} action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="space-y-1.5">
      <input ref={remove} type="hidden" name="remove" defaultValue="" />
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`organic organic-sm inline-flex cursor-pointer items-center gap-1.5 border border-line bg-canvas px-3 py-1.5 text-[11px] font-extrabold text-ink hover:border-primary ${
            pending ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <Icon name="image" className="h-3.5 w-3.5" />
          {pending ? "جارٍ الرفع..." : hasPhoto ? "تغيير الصورة" : "إضافة صورة"}
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (!e.currentTarget.files?.length) return;
              if (remove.current) remove.current.value = "";
              form.current?.requestSubmit();
            }}
          />
        </label>
        {hasPhoto ? (
          <button
            type="submit"
            disabled={pending}
            onClick={() => {
              if (remove.current) remove.current.value = "1";
            }}
            className="text-[11px] font-extrabold text-muted hover:text-humanitarian disabled:opacity-60"
          >
            إزالة
          </button>
        ) : null}
      </div>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}

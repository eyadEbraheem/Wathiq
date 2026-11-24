"use client";

import { useActionState } from "react";
import { ProfileFields } from "@/components/profile/ProfileFields";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FormState } from "@/lib/actions/auth";
import { saveOnboardingProfileAction } from "@/lib/actions/users";
import { keepValuesOnSubmit } from "@/lib/forms";
import type { CurrentUser } from "@/lib/types";

const initialState: FormState = {};

/** Wizard step 2: the same fields as the profile on /me. Skipping goes to the teams step. */
export function ProfileStep({ user }: { user: CurrentUser }) {
  const [state, formAction, pending] = useActionState(saveOnboardingProfileAction, initialState);

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="space-y-4">
      <FormMessage error={state.error} />
      <ProfileFields user={user} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ ومتابعة ←"}
        </Button>
        <ButtonLink href="/onboarding?step=teams" variant="ghost">
          تخطَّ هذه الخطوة
        </ButtonLink>
      </div>
    </form>
  );
}

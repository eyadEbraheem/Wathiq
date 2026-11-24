"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { ProfileFields } from "@/components/profile/ProfileFields";
import { Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { isOrganization } from "@/lib/accounts";
import type { FormState } from "@/lib/actions/auth";
import { updateProfileAction } from "@/lib/actions/users";
import type { CurrentUser } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: FormState = {};

export function ProfileForm({ user }: { user: CurrentUser }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="mt-4 space-y-4">
      <FormMessage error={state.error} notice={state.notice} />
      <Input id="name" name="name" label="الاسم" defaultValue={user.name} required minLength={2} maxLength={80} />
      <Textarea
        id="bio"
        name="bio"
        label={isOrganization(user) ? "نبذة عن الجمعية" : "نبذة عنك"}
        defaultValue={user.bio}
        maxLength={500}
      />
      <ProfileFields user={user} />
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "حفظ"}
      </Button>
    </form>
  );
}

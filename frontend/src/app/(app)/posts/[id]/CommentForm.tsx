"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { controlClasses } from "@/components/ui/Input";
import { FormMessage } from "@/components/ui/FormMessage";
import { addCommentAction } from "@/lib/actions/comments";
import type { FormState } from "@/lib/actions/auth";
import { keepValuesOnSubmit } from "@/lib/forms";

/** A new comment, or a reply when `parentId` is given. Clears itself after posting. */
export function CommentForm({ postId, parentId }: { postId: number; parentId?: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCommentAction, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.notice) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2.5">
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label className="sr-only" htmlFor={`comment-${parentId ?? "new"}`}>
        {parentId ? "ردّك" : "تعليقك"}
      </label>
      <textarea
        id={`comment-${parentId ?? "new"}`}
        name="body"
        required
        maxLength={1000}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "اكتب ردّك…" : "اكتب تعليقاً لطيفاً ومفيداً…"}
        className={`py-3 leading-7 ${controlClasses}`}
      />
      <FormMessage error={state.error} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "جارٍ النشر…" : parentId ? "إرسال الرد" : "نشر التعليق"}
      </Button>
    </form>
  );
}

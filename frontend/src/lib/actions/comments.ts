"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";

/** Adds a comment, or a reply when `parentId` is sent. */
export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const postId = Number(formData.get("postId"));
  const parentId = Number(formData.get("parentId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "اكتب تعليقك أولاً." };
  if (body.length > 1000) return { error: "التعليق أطول من 1000 حرف." };

  const res = await apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body, ...(parentId > 0 ? { parentId } : {}) }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      return { error: "لم يُنشر التعليق: يحتوي على كلمة غير مسموحة، أو أن الرد غير ممكن هنا." };
    }
    if (res.status === 403) return { error: "حسابك موقوف حالياً ولا يمكنه التعليق." };
    if (res.status === 404) return { error: "هذا المنشور لم يعد متاحاً." };
    return { error: "حدث خطأ غير متوقع. حاول مرة أخرى." };
  }
  revalidatePath(`/posts/${postId}`);
  return { notice: "تم نشر تعليقك." };
}

/** Deletes a comment (its author, the post's author or an admin). */
export async function deleteCommentAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const id = Number(formData.get("commentId"));
  const postId = Number(formData.get("postId"));
  if (!Number.isInteger(id) || id < 1) return;
  await apiFetch(`/comments/${id}`, { method: "DELETE", token });
  revalidatePath(`/posts/${postId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/** Follows or unfollows a verified account (the form says which). */
export async function toggleFollowAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const userId = Number(formData.get("userId"));
  const following = formData.get("following") === "true";
  if (!Number.isInteger(userId) || userId < 1) return;
  await apiFetch(`/users/${userId}/follow`, { method: following ? "DELETE" : "POST", token });
  revalidatePath(`/users/${userId}`);
}

/** Reports a post, a comment or an account to the admins. */
export async function reportAction(
  _prev: { error?: string; notice?: string },
  formData: FormData,
): Promise<{ error?: string; notice?: string }> {
  const token = await requireSessionToken();
  const target = String(formData.get("target"));
  const targetId = Number(formData.get("targetId"));
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  if (!reason) return { error: "اختر سبب البلاغ." };
  const res = await apiFetch("/reports", {
    method: "POST",
    token,
    body: JSON.stringify({ target, targetId, reason, ...(details ? { details } : {}) }),
  });
  if (!res.ok) {
    if (res.status === 409) return { error: "أبلغت عن هذا من قبل، وهو قيد المراجعة." };
    if (res.status === 400) return { error: "لا يمكنك الإبلاغ عن نفسك." };
    return { error: "تعذّر إرسال البلاغ. حاول مرة أخرى." };
  }
  return { notice: "وصل بلاغك لفريق واثق. شكراً لك." };
}

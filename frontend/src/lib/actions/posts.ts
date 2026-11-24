"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/** Upvote or remove the upvote (the form says which), then refresh the page it came from. */
export async function toggleUpvoteAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const postId = Number(formData.get("postId"));
  const upvoted = formData.get("upvoted") === "true";
  const back = String(formData.get("back") ?? "/");
  if (!Number.isInteger(postId) || postId < 1) return;
  await apiFetch(`/posts/${postId}/upvote`, { method: upvoted ? "DELETE" : "POST", token });
  revalidatePath(back.startsWith("/") ? back : "/");
}

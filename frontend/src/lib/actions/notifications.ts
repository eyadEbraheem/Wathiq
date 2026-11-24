"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/** Marks one notification read, then opens what it is about. */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const id = Number(formData.get("id"));
  const target = String(formData.get("target") ?? "/notifications");
  if (Number.isInteger(id) && id > 0) {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH", token });
  }
  revalidatePath("/", "layout");
  redirect(target.startsWith("/") ? target : "/notifications");
}

export async function markAllReadAction(): Promise<void> {
  const token = await requireSessionToken();
  await apiFetch("/notifications/read-all", { method: "POST", token });
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/actions/auth";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/** Shares the CV through a new public link. Called again, it replaces the old link. */
export async function enableCvShareAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const renewing = formData.get("renew") === "1";
  const res = await apiFetch("/users/me/cv/share", { method: "POST", token });
  if (!res.ok) return { error: "تعذّر إنشاء رابط السيرة. حاول مرة أخرى." };
  revalidatePath("/cv");
  return {
    notice: renewing
      ? "أُنشئ رابط جديد. الرابط القديم ورمزه لم يعودا يعملان."
      : "صارت سيرتك متاحة عبر الرابط ورمز QR.",
  };
}

/** Stops sharing: the public link and its QR stop working. */
export async function disableCvShareAction(): Promise<FormState> {
  const token = await requireSessionToken();
  const res = await apiFetch("/users/me/cv/share", { method: "DELETE", token });
  if (!res.ok) return { error: "تعذّر إيقاف المشاركة. حاول مرة أخرى." };
  revalidatePath("/cv");
  return { notice: "أُوقفت مشاركة السيرة. الرابط لم يعد يعمل." };
}

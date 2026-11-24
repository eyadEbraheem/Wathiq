"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import type { FormState } from "@/lib/actions/auth";

const GENERIC = "حدث خطأ غير متوقع. حاول مرة أخرى.";

/** The team approves or rejects a request, or removes an approved member. */
export async function decideMembershipAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const id = Number(formData.get("membershipId"));
  const decision = String(formData.get("decision") ?? "");
  if (!Number.isInteger(id) || id < 1 || !["approve", "reject", "remove"].includes(decision)) return;
  await apiFetch(`/team-memberships/${id}/${decision}`, { method: "POST", token });
  revalidatePath("/members");
}

/** Specialties typed so far (suggestions while typing). */
export async function suggestSpecialtiesAction(q: string): Promise<string[]> {
  const token = await requireSessionToken();
  const text = q.trim().slice(0, 80);
  if (text.length < 2) return [];
  const res = await apiFetch(`/specialties?q=${encodeURIComponent(text)}&limit=8`, { token });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: { name: string }[] };
  return body.data.map((s) => s.name);
}

/** Replaces the verified account's specialties (sent as several `names` fields). */
export async function saveSpecialtiesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const names = formData
    .getAll("names")
    .map((n) => String(n).trim())
    .filter((n) => n.length > 0);
  if (names.some((n) => n.length < 2 || n.length > 80)) {
    return { error: "كل اختصاص بين حرفين و80 حرفاً." };
  }
  if (names.length > 10) return { error: "عشرة اختصاصات على الأكثر." };

  const res = await apiFetch("/users/me/specialties", {
    method: "PUT",
    token,
    body: JSON.stringify({ names }),
  });
  if (!res.ok) {
    if (res.status === 403) return { error: "الاختصاصات للحسابات الموثّقة فقط." };
    if (res.status === 400) return { error: "تحقق من الاختصاصات (حتى 10، كل واحد بين حرفين و80 حرفاً)." };
    return { error: GENERIC };
  }
  revalidatePath("/me");
  return { notice: "تم حفظ الاختصاصات." };
}

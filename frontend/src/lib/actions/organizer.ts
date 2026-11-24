"use server";

import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";
import { uploadImages } from "@/lib/uploads";

const GENERIC = "حدث خطأ غير متوقع. حاول مرة أخرى.";
const NO_CHOICE = "اختيارك لم يصل. انتظر حتى يكتمل تحميل الصفحة ثم اضغط مرة أخرى.";

/**
 * The pressed button's value. Before the page's JavaScript has loaded, a form can be sent
 * without it: then nothing happens (never a default decision).
 */
function choice<T extends string>(formData: FormData, allowed: readonly T[]): T | null {
  const value = formData.get("decision");
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}


function refresh(eventId: number) {
  revalidatePath(`/posts/${eventId}/manage`);
  revalidatePath(`/posts/${eventId}`);
  revalidatePath("/applications");
}

/** Accept (into a role when the event has roles) or reject a pending applicant. */
export async function decideApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));
  const applicationId = Number(formData.get("applicationId"));
  const decision = choice(formData, ["accept", "reject"] as const);
  if (!decision) return { error: NO_CHOICE };
  const roleId = Number(formData.get("roleId"));

  const res = await apiFetch(`/event-applications/${applicationId}/${decision}`, {
    method: "POST",
    token,
    body: JSON.stringify(decision === "accept" && roleId > 0 ? { roleId } : {}),
  });
  if (!res.ok) {
    const text = (await apiErrorMessage(res)) ?? "";
    if (res.status === 409) return { error: "لا يوجد مقعد فارغ: الدور أو الفعالية ممتلئة." };
    if (/choose the role/i.test(text)) return { error: "اختر الدور الذي سيأخذه المتطوع." };
    if (/pending/i.test(text)) return { error: "هذا الطلب لم يعد بانتظار القرار." };
    return { error: GENERIC };
  }
  refresh(eventId);
  return { notice: decision === "accept" ? "تم القبول." : "تم الرفض." };
}

/** Moves an accepted volunteer to another role with a free seat. */
export async function moveRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));
  const applicationId = Number(formData.get("applicationId"));
  const roleId = Number(formData.get("roleId"));
  const res = await apiFetch(`/event-applications/${applicationId}/move`, {
    method: "POST",
    token,
    body: JSON.stringify({ roleId }),
  });
  if (!res.ok) {
    if (res.status === 409) return { error: "هذا الدور ممتلئ." };
    const text = (await apiErrorMessage(res)) ?? "";
    if (/already has this role/i.test(text)) return { error: "المتطوع في هذا الدور أصلاً." };
    return { error: GENERIC };
  }
  refresh(eventId);
  return { notice: "تم نقل المتطوع." };
}

/** Closes registration by hand (it will not reopen) or cancels the event. */
export async function eventStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));
  const action = formData.get("action") === "cancel" ? "cancel" : "close";
  if (formData.get("confirm") !== "on") {
    return { error: "علّم على مربع التأكيد أولاً." };
  }
  const res = await apiFetch(`/events/${eventId}/${action}`, { method: "POST", token });
  if (!res.ok) {
    return { error: action === "cancel" ? "تعذّر إلغاء الفعالية." : "تعذّر إغلاق التسجيل." };
  }
  refresh(eventId);
  return { notice: action === "cancel" ? "أُلغيت الفعالية وأُبلغ المتطوعون." : "أُغلق التسجيل." };
}

/** Documents the event (text, photos, impact numbers): it becomes COMPLETED. */
export async function documentEventAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));
  const documentation = String(formData.get("documentation") ?? "").trim();
  if (documentation.length < 10) return { error: "اكتب وصفاً لما حدث (10 أحرف على الأقل)." };

  const metrics: { label: string; value: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const label = String(formData.get(`metricLabel${i}`) ?? "").trim();
    const raw = String(formData.get(`metricValue${i}`) ?? "").trim();
    if (!label && !raw) continue;
    const value = Number(raw);
    if (!label || !Number.isInteger(value) || value < 0) {
      return { error: "كل رقم أثر يحتاج اسماً ورقماً صحيحاً (0 أو أكثر)." };
    }
    metrics.push({ label, value });
  }

  const uploaded = await uploadImages(formData.getAll("images"), token);
  if ("error" in uploaded) return { error: uploaded.error };
  if (uploaded.keys.length === 0) return { error: "أضف صورة واحدة على الأقل من الفعالية." };

  const res = await apiFetch(`/events/${eventId}/documentation`, {
    method: "POST",
    token,
    body: JSON.stringify({ documentation, imageKeys: uploaded.keys, metrics }),
  });
  if (!res.ok) {
    const text = (await apiErrorMessage(res)) ?? "";
    if (/once it has started/i.test(text)) return { error: "يمكن التوثيق بعد أن تبدأ الفعالية." };
    if (/same label/i.test(text)) return { error: "اسم رقم الأثر مكرر." };
    if (/already documented/i.test(text)) return { error: "الفعالية موثّقة من قبل." };
    return { error: GENERIC };
  }
  refresh(eventId);
  return { notice: "تم التوثيق. أصبح بإمكان المتطوعين طلب شاراتهم." };
}

/** Approves (with an optional thank-you line) or rejects a badge request. */
export async function decideBadgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));
  const badgeId = Number(formData.get("badgeId"));
  const decision = choice(formData, ["approve", "reject"] as const);
  if (!decision) return { error: NO_CHOICE };
  const approve = decision === "approve";
  const description = String(formData.get("description") ?? "").trim();
  const res = await apiFetch(`/badges/${badgeId}/${approve ? "approve" : "reject"}`, {
    method: "POST",
    token,
    body: JSON.stringify(approve && description ? { description } : {}),
  });
  if (!res.ok) return { error: GENERIC };
  refresh(eventId);
  return { notice: approve ? "تمت الموافقة على الشارة." : "تم رفض الطلب." };
}

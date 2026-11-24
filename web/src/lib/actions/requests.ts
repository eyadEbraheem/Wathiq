"use server";

import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";
import { uploadImages } from "@/lib/uploads";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const NO_CHOICE = "اختيارك لم يصل. انتظر حتى يكتمل تحميل الصفحة ثم اضغط مرة أخرى.";

/**
 * The pressed button's value. Before the page's JavaScript has loaded, a form can be sent
 * without it: then nothing happens (never a default decision).
 */
function choice<T extends string>(formData: FormData, allowed: readonly T[]): T | null {
  const value = formData.get("decision");
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}


/** A regular user asks a verified account (or the platform) to publish a post or a case. */
export async function sendPublishRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const targetUserId = Number(formData.get("targetUserId"));
  const sectionId = Number(formData.get("sectionId"));
  const title = text(formData, "title");
  const body = text(formData, "body");
  if (!sectionId) return { error: "اختر القسم." };
  if (title.length < 3) return { error: "العنوان قصير جداً (3 أحرف على الأقل)." };
  if (!body) return { error: "اكتب نص الطلب." };

  const images = await uploadImages(formData.getAll("images"), token);
  if ("error" in images) return { error: images.error };

  const payload: Record<string, unknown> = { sectionId, title, body, imageKeys: images.keys };
  if (targetUserId > 0) payload.targetUserId = targetUserId;
  else payload.requestedAttribution = formData.get("attribution") === "PUBLISHER" ? "PUBLISHER" : "REQUESTER";

  if (formData.get("withCase") === "on") {
    const qr = await uploadImages(formData.getAll("paymentQr"), token);
    if ("error" in qr) return { error: qr.error };
    payload.caseDetails = {
      contactPhone: text(formData, "contactPhone"),
      ...(qr.keys[0] ? { paymentQrKey: qr.keys[0] } : {}),
      ...(text(formData, "paymentNote") ? { paymentNote: text(formData, "paymentNote") } : {}),
    };
  }

  const res = await apiFetch("/publish-requests", { method: "POST", token, body: JSON.stringify(payload) });
  if (!res.ok) {
    const message = (await apiErrorMessage(res)) ?? "";
    if (/Verified accounts publish directly/i.test(message)) return { error: "حسابك موثّق: يمكنك النشر مباشرة." };
    if (/does not accept/i.test(message)) return { error: "هذا الحساب لا يستقبل طلبات نشر حالياً." };
    if (/humanitarian section/i.test(message)) return { error: "الحالة الإنسانية في القسم الإنساني فقط." };
    if (/E\.164|contactPhone/i.test(message)) return { error: "رقم التواصل يجب أن يبدأ بـ + ورمز الدولة." };
    if (/suspended/i.test(message)) return { error: "حسابك موقوف حالياً." };
    return { error: "تعذّر إرسال الطلب. حاول مرة أخرى." };
  }
  revalidatePath("/requests");
  return { notice: "أُرسل طلبك. ستصلك النتيجة في الإشعارات." };
}

/** The requester withdraws a pending request. */
export async function cancelPublishRequestAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  await apiFetch(`/publish-requests/${Number(formData.get("id"))}/cancel`, { method: "POST", token });
  revalidatePath("/requests");
}

/** The verified account asked: publish (choosing whose name it carries) or reject. */
export async function decideIncomingRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const id = Number(formData.get("id"));
  const decision = choice(formData, ["credit", "publisher", "reject"] as const);
  if (!decision) return { error: NO_CHOICE };
  const res =
    decision === "reject"
      ? await apiFetch(`/publish-requests/${id}/reject`, {
          method: "POST",
          token,
          body: JSON.stringify(text(formData, "reason") ? { reason: text(formData, "reason") } : {}),
        })
      : await apiFetch(`/publish-requests/${id}/approve`, {
          method: "POST",
          token,
          body: JSON.stringify({ attribution: decision === "credit" ? "REQUESTER" : "PUBLISHER" }),
        });
  if (!res.ok) return { error: res.status === 409 || res.status === 400 ? "تم البت في هذا الطلب من قبل." : "حدث خطأ. حاول مرة أخرى." };
  revalidatePath("/requests");
  return { notice: decision === "reject" ? "تم رفض الطلب." : "نُشر الطلب على حسابك." };
}

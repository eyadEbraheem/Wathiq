"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";

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


const num = (formData: FormData, key: string) => Number(formData.get(key));
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function post(path: string, token: string, body?: unknown) {
  return apiFetch(path, {
    method: "POST",
    token,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Approve or reject a verification request (rejecting needs a reason the user will see). */
export async function decideVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const id = num(formData, "id");
  const decision = choice(formData, ["approve", "reject"] as const);
  if (!decision) return { error: NO_CHOICE };
  const approve = decision === "approve";
  const reason = text(formData, "reason");
  if (!approve && reason.length < 3) return { error: "اكتب سبب الرفض ليعرفه صاحب الطلب." };
  const res = await post(`/verification-requests/${id}/${approve ? "approve" : "reject"}`, token, approve ? undefined : { reason });
  if (!res.ok) return { error: res.status === 400 ? "تم البت في هذا الطلب من قبل." : GENERIC };
  revalidatePath("/admin");
  return { notice: approve ? "تم توثيق الحساب وحُذفت الوثائق." : "تم الرفض وحُذفت الوثائق." };
}

/** Resolves a report (optionally hiding the content and / or suspending its owner) or dismisses it. */
export async function decideReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const id = num(formData, "id");
  const decision = choice(formData, ["resolve", "dismiss"] as const);
  if (!decision) return { error: NO_CHOICE };
  const dismiss = decision === "dismiss";
  const res = dismiss
    ? await post(`/admin/reports/${id}/dismiss`, token)
    : await post(`/admin/reports/${id}/resolve`, token, {
        hideContent: formData.get("hideContent") === "on",
        suspendUser: formData.get("suspendUser") === "on",
      });
  if (!res.ok) {
    return {
      error: res.status === 400 ? "لا يمكن تنفيذ ذلك (قد يكون البلاغ عولج، أو أن الحساب مدير)." : GENERIC,
    };
  }
  revalidatePath("/admin");
  return { notice: dismiss ? "تم تجاهل البلاغ." : "تمت معالجة البلاغ." };
}

/** Publishes or rejects a publish request sent to the platform. */
export async function decidePlatformRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const id = num(formData, "id");
  const decision = choice(formData, ["approve", "reject"] as const);
  if (!decision) return { error: NO_CHOICE };
  const approve = decision === "approve";
  const reason = text(formData, "reason");
  const res = await post(`/publish-requests/${id}/${approve ? "approve" : "reject"}`, token, approve ? {} : reason ? { reason } : {});
  if (!res.ok) return { error: res.status === 409 || res.status === 400 ? "تم البت في هذا الطلب من قبل." : GENERIC };
  revalidatePath("/admin");
  return { notice: approve ? "نُشر الطلب من حساب واثق الرسمي." : "تم رفض الطلب." };
}

/** Suspends or lifts the suspension of an account by its id. */
export async function suspendUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const id = num(formData, "userId");
  const decision = choice(formData, ["suspend", "unsuspend"] as const);
  if (!decision) return { error: NO_CHOICE };
  const suspend = decision === "suspend";
  if (!Number.isInteger(id) || id < 1) return { error: "أدخل رقم حساب صحيحاً." };
  const res = await post(`/admin/users/${id}/${suspend ? "suspend" : "unsuspend"}`, token);
  if (!res.ok) {
    if (res.status === 404) return { error: "لا يوجد حساب بهذا الرقم." };
    if (res.status === 400) return { error: "لا يمكن إيقاف مدير أو الحساب الرسمي أو حسابك." };
    return { error: GENERIC };
  }
  revalidatePath("/admin");
  return { notice: suspend ? `تم إيقاف الحساب ${id}.` : `تم رفع الإيقاف عن الحساب ${id}.` };
}

export async function addBannedWordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const word = text(formData, "word");
  if (!word) return { error: "اكتب الكلمة." };
  const res = await post("/admin/banned-words", token, { word });
  if (!res.ok) return { error: res.status === 409 ? "هذه الكلمة ممنوعة أصلاً." : GENERIC };
  revalidatePath("/admin");
  return { notice: `أُضيفت «${word}».` };
}

export async function removeBannedWordAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  await apiFetch(`/admin/banned-words/${num(formData, "id")}`, { method: "DELETE", token });
  revalidatePath("/admin");
}

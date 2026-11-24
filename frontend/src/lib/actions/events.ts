"use server";

import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";

/** The API speaks English; the web shows these Arabic messages for its known refusals. */
const APPLY_ERRORS: [RegExp, string][] = [
  [/deadline/i, "انتهى موعد التقديم على هذه الفعالية."],
  [/years old/i, "عمرك يوم الفعالية أقل من الحد الأدنى المطلوب."],
  [/not accepting/i, "التسجيل في هذه الفعالية مغلق."],
  [/required question/i, "أجب عن الأسئلة المطلوبة."],
  [/roles?/i, "اختر دوراً واحداً على الأقل من أدوار الفعالية."],
  [/own event/i, "لا يمكنك التقديم على فعاليتك."],
  [/suspended/i, "حسابك موقوف حالياً."],
];

/** Applies to an event: ranked role choices (if any), answers and an optional message. */
export async function applyToEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const eventId = Number(formData.get("eventId"));

  const roleIds: number[] = [];
  for (const key of ["role1", "role2", "role3"]) {
    const id = Number(formData.get(key));
    if (Number.isInteger(id) && id > 0 && !roleIds.includes(id)) roleIds.push(id);
  }
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:") && typeof value === "string" && value.trim()) {
      answers[key.slice("answer:".length)] = value.trim();
    }
  }
  const message = String(formData.get("message") ?? "").trim();

  const res = await apiFetch(`/events/${eventId}/applications`, {
    method: "POST",
    token,
    body: JSON.stringify({
      ...(roleIds.length ? { roleIds } : {}),
      ...(Object.keys(answers).length ? { answers } : {}),
      ...(message ? { message } : {}),
    }),
  });
  if (!res.ok) {
    if (res.status === 409) return { error: "سبق أن قدّمت على هذه الفعالية." };
    const text = (await apiErrorMessage(res)) ?? "";
    const known = APPLY_ERRORS.find(([pattern]) => pattern.test(text));
    return { error: known?.[1] ?? "تعذّر إرسال طلبك. حاول مرة أخرى." };
  }
  revalidatePath(`/posts/${eventId}`);
  return { notice: "وصل طلبك للمنظّم، وسيصلك إشعار بالقرار." };
}

/** Withdraws the caller's application (only before the application deadline). */
export async function withdrawApplicationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const applicationId = Number(formData.get("applicationId"));
  const eventId = Number(formData.get("eventId"));
  const res = await apiFetch(`/event-applications/${applicationId}/withdraw`, {
    method: "POST",
    token,
  });
  if (!res.ok) {
    const text = (await apiErrorMessage(res)) ?? "";
    if (/deadline/i.test(text)) {
      return { error: "انتهى موعد التقديم، لم يعد الانسحاب ممكناً. تواصل مع المنظّم." };
    }
    return { error: "تعذّر الانسحاب. حاول مرة أخرى." };
  }
  revalidatePath(`/posts/${eventId}`);
  return { notice: "تم سحب طلبك." };
}

/** Requests the badge (or certificate) for an accepted application of a completed event. */
export async function requestBadgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const applicationId = Number(formData.get("applicationId"));
  const eventId = Number(formData.get("eventId"));
  const res = await apiFetch("/badges", {
    method: "POST",
    token,
    body: JSON.stringify({ applicationId }),
  });
  if (!res.ok) {
    if (res.status === 409) return { error: "طلبت هذه الشارة من قبل." };
    return { error: "تعذّر طلب الشارة. حاول مرة أخرى." };
  }
  revalidatePath(`/posts/${eventId}`);
  return { notice: "وصل طلبك للمنظّم." };
}

/** Rates the organizer 1 to 5 stars (editable for 30 days after the documentation). */
export async function rateOrganizerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const applicationId = Number(formData.get("applicationId"));
  const eventId = Number(formData.get("eventId"));
  const stars = Number(formData.get("stars"));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "اختر من نجمة إلى 5 نجوم." };
  const res = await apiFetch("/ratings", {
    method: "PUT",
    token,
    body: JSON.stringify({ applicationId, stars }),
  });
  if (!res.ok) {
    const text = (await apiErrorMessage(res)) ?? "";
    if (/locked/i.test(text)) return { error: "انتهت مدة التقييم (30 يوماً بعد التوثيق)." };
    return { error: "تعذّر حفظ التقييم." };
  }
  revalidatePath(`/posts/${eventId}`);
  return { notice: "شكراً، حُفظ تقييمك." };
}

/** Shows or hides one of the caller's approved badges on their public profile. */
export async function toggleBadgeVisibilityAction(formData: FormData): Promise<void> {
  const token = await requireSessionToken();
  const badgeId = Number(formData.get("badgeId"));
  const show = formData.get("show") === "true";
  if (!Number.isInteger(badgeId) || badgeId < 1) return;
  await apiFetch(`/badges/${badgeId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ isShownOnProfile: show }),
  });
  revalidatePath("/badges");
}

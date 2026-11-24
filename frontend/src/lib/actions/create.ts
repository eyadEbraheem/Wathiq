"use server";

import { redirect } from "next/navigation";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";
import { uploadImages } from "@/lib/uploads";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** A `datetime-local` value is Syria's local time (UTC+3 all year); the API wants UTC ISO. */
function damascusToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const ids = (formData: FormData, key: string) =>
  formData
    .getAll(key)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

/** Arabic messages for the API's known refusals. */
const CREATE_ERRORS: [RegExp, string][] = [
  [/verified accounts/i, "النشر متاح للحسابات الموثّقة فقط."],
  [/suspended/i, "حسابك موقوف حالياً."],
  [/topic/i, "المواضيع يجب أن تكون من القسم نفسه."],
  [/humanitarian section/i, "تفاصيل الحالة الإنسانية مسموحة في القسم الإنساني فقط."],
  [/education section/i, "تفاصيل الفرصة مسموحة في القسم التعليمي فقط."],
  [/deadline must be in the future/i, "آخر موعد يجب أن يكون في المستقبل."],
  [/start in the future/i, "يجب أن تبدأ الفعالية في المستقبل."],
  [/end after it starts/i, "يجب أن تنتهي الفعالية بعد بدايتها."],
  [/deadline cannot be after/i, "آخر موعد للتقديم يجب أن يكون قبل بداية الفعالية."],
  [/capacity or roles/i, "حدّد عدد المقاعد أو الأدوار، وليس الاثنين معاً."],
  [/Role names must be unique/i, "أسماء الأدوار يجب أن تكون مختلفة."],
  [/E\.164|contactPhone/i, "رقم التواصل يجب أن يبدأ بـ + ورمز الدولة، مثل ‎+963912345678."],
  [/applyUrl|url/i, "رابط التقديم غير صحيح (يبدأ بـ https://)."],
];

async function explain(res: Response): Promise<string> {
  const message = (await apiErrorMessage(res)) ?? "";
  return CREATE_ERRORS.find(([p]) => p.test(message))?.[1] ?? "تعذّر النشر. راجع الحقول وحاول مرة أخرى.";
}

/** Publishes a post, optionally a humanitarian case or an external opportunity. */
export async function createPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const sectionId = Number(formData.get("sectionId"));
  const title = text(formData, "title");
  const body = text(formData, "body");
  if (!sectionId) return { error: "اختر القسم." };
  if (title.length < 3) return { error: "العنوان قصير جداً (3 أحرف على الأقل)." };
  if (!body) return { error: "اكتب نص المنشور." };

  const uploaded = await uploadImages(formData.getAll("images"), token);
  if ("error" in uploaded) return { error: uploaded.error };

  const payload: Record<string, unknown> = {
    sectionId,
    title,
    body,
    topicIds: ids(formData, "topicIds"),
    imageKeys: uploaded.keys,
  };

  if (formData.get("withCase") === "on") {
    const qr = await uploadImages(formData.getAll("paymentQr"), token);
    if ("error" in qr) return { error: qr.error };
    payload.caseDetails = {
      contactPhone: text(formData, "contactPhone"),
      ...(qr.keys[0] ? { paymentQrKey: qr.keys[0] } : {}),
      ...(text(formData, "paymentNote") ? { paymentNote: text(formData, "paymentNote") } : {}),
    };
  }
  if (formData.get("withOpportunity") === "on") {
    const deadline = text(formData, "deadline");
    payload.opportunity = {
      applyUrl: text(formData, "applyUrl"),
      mode: text(formData, "mode") || "ONLINE",
      ...(deadline ? { deadline: damascusToIso(`${deadline}T23:59`) } : {}),
      ...(text(formData, "location") ? { location: text(formData, "location") } : {}),
      ...(text(formData, "eligibility") ? { eligibility: text(formData, "eligibility") } : {}),
      ...(text(formData, "field") ? { field: text(formData, "field") } : {}),
    };
  }

  const res = await apiFetch("/posts", { method: "POST", token, body: JSON.stringify(payload) });
  if (!res.ok) return { error: await explain(res) };
  const { id } = (await res.json()) as { id: number };
  redirect(`/posts/${id}`);
}

/** Creates an event with optional roles (capacity = their seats) and questions. */
export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const sectionId = Number(formData.get("sectionId"));
  const title = text(formData, "title");
  const body = text(formData, "body");
  const startsAt = damascusToIso(text(formData, "startsAt"));
  const endsAt = text(formData, "endsAt") ? damascusToIso(text(formData, "endsAt")) : null;
  const deadline = text(formData, "applicationDeadline")
    ? damascusToIso(text(formData, "applicationDeadline"))
    : null;
  if (!sectionId) return { error: "اختر القسم." };
  if (title.length < 3) return { error: "العنوان قصير جداً (3 أحرف على الأقل)." };
  if (!body) return { error: "اكتب وصف الفعالية." };
  if (!startsAt) return { error: "حدّد موعد بداية الفعالية." };
  if (!text(formData, "governorate") || !text(formData, "city")) {
    return { error: "حدّد المحافظة والمدينة." };
  }

  const roles: { name: string; seats: number }[] = [];
  for (let i = 0; i < 5; i += 1) {
    const name = text(formData, `roleName${i}`);
    const seats = Number(text(formData, `roleSeats${i}`));
    if (!name && !text(formData, `roleSeats${i}`)) continue;
    if (!name || !Number.isInteger(seats) || seats < 1) {
      return { error: "كل دور يحتاج اسماً وعدد مقاعد (1 أو أكثر)." };
    }
    roles.push({ name, seats });
  }
  const questions: { text: string; required: boolean }[] = [];
  for (let i = 0; i < 3; i += 1) {
    const q = text(formData, `question${i}`);
    if (q) questions.push({ text: q, required: formData.get(`questionRequired${i}`) === "on" });
  }
  const capacity = Number(text(formData, "capacity"));
  const minAge = Number(text(formData, "minAge"));
  const volunteerHours = Number(text(formData, "volunteerHours"));
  if (!Number.isInteger(volunteerHours) || volunteerHours < 1 || volunteerHours > 500) {
    return { error: "اكتب عدد ساعات التطوع (رقم صحيح من 1 إلى 500)." };
  }

  const uploaded = await uploadImages(formData.getAll("images"), token);
  if ("error" in uploaded) return { error: uploaded.error };

  const payload = {
    sectionId,
    title,
    body,
    topicIds: ids(formData, "topicIds"),
    imageKeys: uploaded.keys,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    ...(deadline ? { applicationDeadline: deadline } : {}),
    governorate: text(formData, "governorate"),
    city: text(formData, "city"),
    volunteerHours,
    ...(text(formData, "locationText") ? { locationText: text(formData, "locationText") } : {}),
    ...(minAge >= 13 ? { minAge } : {}),
    ...(roles.length ? { roles } : capacity > 0 ? { capacity } : {}),
    ...(questions.length ? { questions } : {}),
  };

  const res = await apiFetch("/events", { method: "POST", token, body: JSON.stringify(payload) });
  if (!res.ok) return { error: await explain(res) };
  const { id } = (await res.json()) as { id: number };
  redirect(`/posts/${id}`);
}

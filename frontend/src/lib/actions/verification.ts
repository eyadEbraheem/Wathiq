"use server";

import { ORGANIZATION_PAPERS } from "@csh/shared";
import { revalidatePath } from "next/cache";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import type { FormState } from "@/lib/actions/auth";
import { requireSessionToken } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sends a verification request (multipart): the ID document and up to three supporting files
 * go to the API's private storage; only admins can open them, and they are deleted after the
 * decision.
 */
export async function requestVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = await requireSessionToken();
  const kind = formData.get("kind") === "INDIVIDUAL" ? "INDIVIDUAL" : "ORGANIZATION";
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const foundedAt = String(formData.get("foundedAt") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const idDocumentType = formData.get("idDocumentType") === "PASSPORT" ? "PASSPORT" : "ID_CARD";
  const links = String(formData.get("links") ?? "")
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const idDocument = formData.get("idDocument");
  const supporting = formData
    .getAll("supporting")
    .filter((f): f is File => f instanceof File && f.size > 0);
  // One file per organization paper, in order (paper0, paper1, ...).
  const papers = ORGANIZATION_PAPERS.map((_, i) => formData.get(`paper${i}`));

  if (!/^\+[1-9]\d{7,14}$/.test(contactPhone)) {
    return { error: "رقم التواصل يجب أن يبدأ بـ + ورمز الدولة، مثل ‎+963912345678." };
  }
  if (kind === "ORGANIZATION" && !foundedAt) return { error: "أدخل تاريخ تأسيس المنظمة." };
  if (!(idDocument instanceof File) || idDocument.size === 0) {
    return { error: "أرفق صورة الهوية أو جواز السفر." };
  }
  if (supporting.length > 3) return { error: "يمكن إرفاق 3 ملفات داعمة على الأكثر." };
  const paperFiles = papers.filter((f): f is File => f instanceof File && f.size > 0);
  if (kind === "ORGANIZATION" && paperFiles.length !== ORGANIZATION_PAPERS.length) {
    return { error: "أرفق كل أوراق الجمعية المطلوبة." };
  }
  if ([idDocument, ...supporting, ...paperFiles].some((f) => f.size > MAX_BYTES)) {
    return { error: "كل ملف يجب ألا يتجاوز 10 ميغابايت." };
  }

  const body = new FormData();
  body.set("kind", kind);
  body.set("contactPhone", contactPhone);
  body.set("idDocumentType", idDocumentType);
  if (details) body.set("details", details);
  if (kind === "ORGANIZATION") body.set("foundedAt", foundedAt);
  for (const link of links) body.append("links", link);
  body.set("idDocument", idDocument, idDocument.name);
  for (const file of supporting) body.append("supporting", file, file.name);
  if (kind === "ORGANIZATION") for (const file of paperFiles) body.append("papers", file, file.name);

  const res = await apiFetch("/verification-requests", { method: "POST", token, body });
  if (!res.ok) {
    if (res.status === 409) return { error: "لديك طلب قيد المراجعة بالفعل." };
    const text = (await apiErrorMessage(res)) ?? "";
    if (/already verified/i.test(text)) return { error: "حسابك موثّق بالفعل." };
    if (/papers/i.test(text)) return { error: "أرفق كل أوراق الجمعية المطلوبة." };
    if (/links|url/i.test(text)) return { error: "أحد الروابط غير صحيح (يجب أن يبدأ بـ https://)." };
    if (/type|file/i.test(text)) return { error: "الملفات المسموحة: JPG أو PNG أو WebP أو PDF." };
    if (/foundedAt|future/i.test(text)) return { error: "تاريخ التأسيس غير صحيح." };
    return { error: "تعذّر إرسال الطلب. حاول مرة أخرى." };
  }
  revalidatePath("/verify");
  return { notice: "وصل طلبك. يراجعه فريق واثق، وسيصلك إشعار بالنتيجة." };
}

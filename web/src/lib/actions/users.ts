"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import { uploadImages } from "@/lib/uploads";
import type { FormState } from "@/lib/actions/auth";
import type { Paginated, UserCard } from "@/lib/types";

const GENERIC = "حدث خطأ غير متوقع. حاول مرة أخرى.";

const numbers = (values: FormDataEntryValue[]) =>
  values.map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** Onboarding step: interests are required, then the wizard is marked complete. */
export async function saveInterestsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const sectionIds = numbers(formData.getAll("sectionIds"));
  const topicIds = numbers(formData.getAll("topicIds"));
  const primary = Number(formData.get("primarySectionId"));

  if (sectionIds.length === 0) return { error: "اختر قسماً واحداً على الأقل." };
  if (topicIds.length === 0) return { error: "اختر موضوعاً واحداً على الأقل من الأقسام التي اخترتها." };

  const res = await apiFetch("/users/me/interests", {
    method: "PUT",
    token,
    body: JSON.stringify({
      sectionIds,
      topicIds,
      primarySectionId: sectionIds.includes(primary) ? primary : sectionIds[0],
    }),
  });
  if (!res.ok) {
    if (res.status === 400) return { error: "كل موضوع يجب أن يكون من الأقسام التي اخترتها." };
    return { error: GENERIC };
  }

  const done = await apiFetch("/users/me/onboarding/complete", { method: "POST", token });
  if (!done.ok) return { error: GENERIC };

  revalidatePath("/", "layout");
  // From sign-up the wizard goes on to the optional steps; from /me it goes back.
  redirect(String(formData.get("next") ?? "/") === "/me" ? "/me" : "/onboarding?step=profile");
}

const optional = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const name = optional(formData, "name");
  if (name.length < 2) return { error: "الاسم قصير جداً." };

  const governorate = optional(formData, "governorate");
  const educationLevel = optional(formData, "educationLevel");
  const res = await apiFetch("/users/me/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      name,
      bio: optional(formData, "bio"),
      governorate: governorate || null,
      city: optional(formData, "city"),
      neighborhood: optional(formData, "neighborhood"),
      educationLevel: educationLevel || null,
      fieldOfStudy: optional(formData, "fieldOfStudy"),
      workField: optional(formData, "workField"),
    }),
  });
  if (!res.ok) {
    if (res.status === 400) return { error: "تحقق من البيانات (الأطوال المسموحة)." };
    return { error: GENERIC };
  }
  revalidatePath("/", "layout");
  return { notice: "تم حفظ ملفك الشخصي." };
}

export async function updatePrivacyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const on = (key: string) => formData.get(key) === "on";
  const res = await apiFetch("/users/me/privacy", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      showAddress: on("showAddress"),
      // The person-only switches are not on an organization's form; leave them as they are.
      ...(formData.get("organization") === "1"
        ? {}
        : {
            showAge: on("showAge"),
            showEducation: on("showEducation"),
            showWorkField: on("showWorkField"),
            showTeams: on("showTeams"),
            showInSearch: on("showInSearch"),
          }),
      // These two switches are only on the form for verified accounts.
      ...(formData.get("verified") === "1"
        ? { hideRating: on("hideRating"), acceptsPublishRequests: on("acceptsPublishRequests") }
        : {}),
    }),
  });
  if (!res.ok) return { error: GENERIC };
  revalidatePath("/me");
  return { notice: "تم حفظ إعدادات الخصوصية." };
}

/** Sets the profile photo from the picked image, or removes it (`remove` = "1"). */
export async function updateAvatarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  let imageKey: string | null = null;
  if (formData.get("remove") !== "1") {
    const uploaded = await uploadImages(formData.getAll("photo"), token);
    if ("error" in uploaded) return { error: uploaded.error };
    if (uploaded.keys.length === 0) return { error: "اختر صورة أولاً." };
    imageKey = uploaded.keys[0];
  }
  const res = await apiFetch("/users/me/avatar", {
    method: "PATCH",
    token,
    body: JSON.stringify({ imageKey }),
  });
  if (res.status === 403) return { error: "حسابك موقوف حالياً." };
  if (!res.ok) return { error: GENERIC };
  // The sidebar and every page show the photo.
  revalidatePath("/", "layout");
  return { notice: imageKey ? "تم تحديث الصورة." : "تمت إزالة الصورة." };
}

/** Sign-up wizard, step 2 (skippable): address, education and work field. */
export async function saveOnboardingProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const governorate = optional(formData, "governorate");
  const educationLevel = optional(formData, "educationLevel");
  const res = await apiFetch("/users/me/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify({
      governorate: governorate || null,
      city: optional(formData, "city"),
      neighborhood: optional(formData, "neighborhood"),
      educationLevel: educationLevel || null,
      fieldOfStudy: optional(formData, "fieldOfStudy"),
      workField: optional(formData, "workField"),
    }),
  });
  if (!res.ok) {
    if (res.status === 400) return { error: "تحقق من البيانات (الأطوال المسموحة)." };
    return { error: GENERIC };
  }
  revalidatePath("/", "layout");
  // The teams step is a person's; the page sends organizations home from there.
  redirect("/onboarding?step=teams");
}

/** Verified accounts whose name matches what the user typed (suggestions while typing). */
export async function searchTeamsAction(q: string): Promise<UserCard[]> {
  const token = await requireSessionToken();
  const text = q.trim().slice(0, 100);
  if (text.length < 2) return [];
  const res = await apiFetch(`/search/accounts?q=${encodeURIComponent(text)}&limit=6`, { token });
  if (!res.ok) return [];
  return ((await res.json()) as Paginated<UserCard>).data.map(
    ({ id, name, avatarUrl, verifiedKind, isPartner, isOfficial }) => ({
      id,
      name,
      avatarUrl,
      verifiedKind,
      isPartner,
      isOfficial,
    }),
  );
}

/** Asks a verified team to list the user as a member; shows on the profile once approved. */
export async function requestMembershipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const teamId = Number(formData.get("teamId"));
  if (!Number.isInteger(teamId) || teamId < 1) return { error: "اختر الجمعية من القائمة." };
  const year = (key: string) => {
    const value = optional(formData, key);
    return value ? Number(value) : null;
  };
  const startYear = year("startYear");
  const endYear = year("endYear");

  const res = await apiFetch("/team-memberships", {
    method: "POST",
    token,
    body: JSON.stringify({
      teamId,
      role: optional(formData, "role") || undefined,
      startYear,
      endYear,
    }),
  });
  if (!res.ok) {
    if (res.status === 409) return { error: "أرسلت طلباً لهذه الجمعية من قبل." };
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body.message[0] : (body?.message ?? "");
      if (message.includes("own account")) return { error: "لا يمكنك الانضمام إلى حسابك نفسه." };
      if (message.includes("future")) return { error: "السنة لا يمكن أن تكون في المستقبل." };
      if (message.includes("before")) return { error: "سنة الانتهاء قبل سنة البداية." };
      return { error: "تحقق من البيانات (السنوات بين 1950 والسنة الحالية)." };
    }
    return { error: GENERIC };
  }
  revalidatePath("/onboarding");
  return { notice: "أرسلنا طلبك. يظهر في ملفك بعد موافقة الجمعية." };
}

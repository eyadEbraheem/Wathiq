"use server";

import { redirect } from "next/navigation";
import { apiErrorMessage, apiFetch, fetchCurrentUser } from "@/lib/api";
import { clearSession, getRefreshToken, requireSessionToken, setSession } from "@/lib/session";
import type { AuthTokens, CurrentUser } from "@/lib/types";

// Forms show Arabic messages. API messages are English for now (translation keys later),
// so known statuses are mapped here and anything else gets a generic message.

const GENERIC = "حدث خطأ غير متوقع. حاول مرة أخرى.";

export interface SignupState {
  error?: string;
  signupId?: number;
  email?: string;
}

export interface FormState {
  error?: string;
  notice?: string;
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const organization = formData.get("accountKind") === "ORGANIZATION";
  const name = String(formData.get("name") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !birthDate || !email || !password) {
    return { error: "يرجى تعبئة جميع الحقول." };
  }
  if (password.length < 8) {
    return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
  }

  const res = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, birthDate, email, password, organization, locale: "ar" }),
  });
  if (res.ok) {
    const body = (await res.json()) as { signupId: number };
    return { signupId: body.signupId, email };
  }

  const message = await apiErrorMessage(res);
  if (res.status === 409) return { error: "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول بدلاً من ذلك." };
  if (res.status === 429) return { error: "محاولات كثيرة لهذا البريد. حاول بعد قليل." };
  if (res.status === 503) return { error: "تعذّر إرسال الرمز الآن. حاول بعد دقيقة." };
  if (res.status === 400 && message?.includes("13")) {
    return { error: "يجب أن يكون عمرك 13 سنة على الأقل للتسجيل." };
  }
  if (res.status === 400 && message?.includes("founding")) {
    return { error: "تاريخ التأسيس لا يمكن أن يكون في المستقبل." };
  }
  if (res.status === 400) return { error: "تحقق من البيانات المدخلة (البريد، تاريخ الميلاد، كلمة المرور)." };
  return { error: GENERIC };
}

export async function verifySignupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const signupId = Number(formData.get("signupId"));
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "الرمز مكوّن من 6 أرقام." };

  const res = await apiFetch("/auth/signup/verify", {
    method: "POST",
    body: JSON.stringify({ signupId, code, deviceInfo: "web" }),
  });
  if (!res.ok) {
    const message = await apiErrorMessage(res);
    if (res.status === 409) return { error: "تم إنشاء حساب بهذا البريد في هذه الأثناء. سجّل الدخول." };
    if (message?.includes("Too many")) return { error: "محاولات خاطئة كثيرة. اطلب رمزاً جديداً." };
    return { error: "الرمز غير صحيح أو انتهت صلاحيته." };
  }

  const { user, tokens } = (await res.json()) as { user: CurrentUser; tokens: AuthTokens };
  await setSession(tokens);
  // An organization sends its papers first; everything else waits for the approval.
  redirect(user.pendingOrganization ? "/verify" : "/onboarding");
}

export async function resendCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const signupId = Number(formData.get("signupId"));
  const res = await apiFetch("/auth/signup/resend", {
    method: "POST",
    body: JSON.stringify({ signupId }),
  });
  if (res.ok) return { notice: "أرسلنا رمزاً جديداً." };
  if (res.status === 429) return { error: "انتظر دقيقة قبل طلب رمز جديد." };
  if (res.status === 400) return { error: "انتهت صلاحية التسجيل. ابدأ من جديد." };
  return { error: GENERIC };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور." };

  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password, deviceInfo: "web" }),
  });
  if (!res.ok) {
    if (res.status === 429) return { error: "محاولات كثيرة. حاول بعد دقيقة." };
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  }

  const { user, tokens } = (await res.json()) as { user: CurrentUser; tokens: AuthTokens };
  await setSession(tokens);
  redirect(user.onboardingCompletedAt ? "/" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    // Revoke on the API too; ignore failures, the cookies are cleared anyway.
    await apiFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }
  await clearSession();
  redirect("/");
}

// ── Password reset ──────────────────────────────────────────────────────────

export interface ResetState {
  error?: string;
  notice?: string;
  /** Set once a code was requested: the form moves to the code step. */
  email?: string;
}

/** Step 1 (and "send a new code"): the API answers the same whether the account exists or not. */
export async function requestResetCodeAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const again = formData.get("again") === "1";
  if (!email) return { error: "أدخل بريدك الإلكتروني." };

  const res = await apiFetch("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ identifier: email }),
  });
  if (res.ok) {
    return { email, notice: again ? "إذا كان الحساب موجوداً، أرسلنا رمزاً جديداً." : undefined };
  }
  if (res.status === 429) return { email: again ? email : undefined, error: "محاولات كثيرة. حاول بعد دقيقة." };
  if (res.status === 400) return { error: "تحقق من البريد الإلكتروني." };
  return { email: again ? email : undefined, error: GENERIC };
}

/** Step 2: the code + the new password. On success the user signs in again. */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!/^\d{6}$/.test(code)) return { email, error: "الرمز مكوّن من 6 أرقام." };
  if (newPassword.length < 8) return { email, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
  if (newPassword !== confirm) return { email, error: "كلمتا المرور غير متطابقتين." };

  const res = await apiFetch("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ identifier: email, code, newPassword }),
  });
  if (!res.ok) {
    if (res.status === 429) return { email, error: "محاولات كثيرة. حاول بعد دقيقة." };
    const message = await apiErrorMessage(res);
    if (message?.includes("Too many")) return { email, error: "محاولات خاطئة كثيرة. اطلب رمزاً جديداً." };
    if (res.status === 400 && message?.includes("newPassword")) {
      return { email, error: "كلمة المرور يجب أن تكون بين 8 و 72 حرفاً." };
    }
    if (res.status === 400) return { email, error: "الرمز غير صحيح أو انتهت صلاحيته." };
    return { email, error: GENERIC };
  }
  // The API signed out every device; from settings the old cookies would still be here.
  await clearSession();
  redirect("/login?reset=1");
}

/** Settings → "forgot your password?": sends a reset code to the signed-in user's own contact. */
export async function sendMyResetCodeAction(): Promise<ResetState> {
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  const identifier = user?.email ?? user?.phone;
  if (!identifier) return { error: "لا يوجد بريد إلكتروني في حسابك لإرسال الرمز إليه." };

  const res = await apiFetch("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
  if (res.ok) return { email: identifier, notice: `أرسلنا رمزاً إلى ${identifier}.` };
  if (res.status === 429) return { error: "محاولات كثيرة. حاول بعد دقيقة." };
  return { error: GENERIC };
}

/** Settings: change the password with the current one. This device stays signed in. */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = await requireSessionToken();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) return { error: "أدخل كلمة المرور الحالية والجديدة." };
  if (newPassword.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  if (newPassword !== confirm) return { error: "كلمتا المرور الجديدتان غير متطابقتين." };

  const res = await apiFetch("/auth/password/change", {
    method: "POST",
    token,
    body: JSON.stringify({ currentPassword, newPassword, deviceInfo: "web" }),
  });
  if (!res.ok) {
    if (res.status === 429) return { error: "محاولات كثيرة. حاول بعد دقيقة." };
    const message = await apiErrorMessage(res);
    if (message?.startsWith("Current password")) return { error: "كلمة المرور الحالية غير صحيحة." };
    if (message?.includes("different")) return { error: "اختر كلمة مرور مختلفة عن الحالية." };
    if (res.status === 400) return { error: "كلمة المرور يجب أن تكون بين 8 و 72 حرفاً." };
    return { error: GENERIC };
  }
  // The API signed out the other devices and sent a new pair for this one.
  await setSession((await res.json()) as AuthTokens);
  return { notice: "تم تغيير كلمة المرور. خرجنا من حسابك على الأجهزة الأخرى." };
}

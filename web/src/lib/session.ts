import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthTokens } from "@/lib/types";

// Two httpOnly cookies, never readable by client JavaScript:
// - access: the short-lived JWT sent to the API as a Bearer token (expires with the token)
// - refresh: the long-lived refresh token; middleware.ts uses it to get a new access token
export const ACCESS_COOKIE = "access";
export const REFRESH_COOKIE = "refresh";

/** Seconds from now until an ISO date, minus a small safety margin. */
export function secondsUntil(iso: string, marginSeconds = 30): number {
  return Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000) - marginSeconds);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/** Only callable from Server Actions and Route Handlers. */
export async function setSession(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    maxAge: secondsUntil(tokens.accessTokenExpiresAt),
  });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: secondsUntil(tokens.refreshTokenExpiresAt),
  });
}

/** Only callable from Server Actions and Route Handlers. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function requireSessionToken(): Promise<string> {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}

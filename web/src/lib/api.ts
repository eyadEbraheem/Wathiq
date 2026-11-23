import "server-only";
import { headers as requestHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { clearSession } from "@/lib/session";
import type { CurrentUser } from "@/lib/types";

export const API_URL = process.env.API_URL ?? "http://localhost:3000/api/v1";

/** Shared with the API (same value on both hosts). Empty locally. */
const WEB_PROXY_SECRET = process.env.WEB_PROXY_SECRET ?? "";

/** The visitor's IP as the host (Vercel) reports it: first entry of X-Forwarded-For. */
export function visitorIp(get: (name: string) => string | null): string | null {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || get("x-real-ip")?.trim() || null;
}

/**
 * When hosted, every call reaches the API from this server, so the API would rate-limit all
 * visitors together. Pass the visitor's IP along, with the shared secret that makes the API
 * believe it (api/src/common/utils/client-ip.ts). Does nothing without the secret.
 */
export async function proxyHeaders(): Promise<Record<string, string>> {
  if (!WEB_PROXY_SECRET) return {};
  try {
    const incoming = await requestHeaders();
    const ip = visitorIp((name) => incoming.get(name));
    return ip ? { "x-client-ip": ip, "x-proxy-secret": WEB_PROXY_SECRET } : {};
  } catch {
    // Outside a request (build time): nothing to forward.
    return {};
  }
}

/**
 * Every backend call goes through here (server side only). With a token, a 401 means the
 * session is over: clear it and go to /login.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<Response> {
  const { token, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  for (const [name, value] of Object.entries(await proxyHeaders())) headers.set(name, value);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // JSON bodies are strings; FormData (file uploads) sets its own multipart header.
  if (typeof rest.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...rest, headers });

  if (res.status === 401 && token) {
    try {
      await clearSession();
    } catch {
      // Server Components cannot change cookies; middleware cleans up on the next request.
    }
    redirect("/login");
  }
  return res;
}

/** The signed-in user, or null. Never redirects: safe on public pages. */
export async function fetchCurrentUser(token: string | null): Promise<CurrentUser | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { ...(await proxyHeaders()), Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as CurrentUser) : null;
  } catch {
    return null;
  }
}

/** Unread notifications for the bell; 0 when signed out or the API is down. */
export async function fetchUnreadCount(token: string | null): Promise<number> {
  if (!token) return 0;
  try {
    const res = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: { ...(await proxyHeaders()), Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as { count: number }).count : 0;
  } catch {
    return 0;
  }
}

/** First error message from the API's `{ statusCode, message, error }` body. */
export async function apiErrorMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message[0] : (body.message ?? null);
  } catch {
    return null;
  }
}

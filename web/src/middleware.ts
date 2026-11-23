import { NextResponse, type NextRequest } from "next/server";

// Keeps users signed in: when the short-lived access cookie has expired but the refresh
// cookie is still there, get a new token pair from the API before the page renders.
// (Server Components cannot set cookies, so this has to happen here.)

const API_URL = process.env.API_URL ?? "http://localhost:3000/api/v1";
// Same as lib/api.ts (that file is server-only, so it cannot be imported here).
const WEB_PROXY_SECRET = process.env.WEB_PROXY_SECRET ?? "";
const ACCESS = "access";
const REFRESH = "refresh";
const MARGIN_SECONDS = 30;

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function maxAge(iso: string): number {
  return Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000) - MARGIN_SECONDS);
}

/** The visitor's IP for the API's rate limit (see proxyHeaders in lib/api.ts). */
function forwardVisitor(request: NextRequest): Record<string, string> {
  if (!WEB_PROXY_SECRET) return {};
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  return ip ? { "x-client-ip": ip, "x-proxy-secret": WEB_PROXY_SECRET } : {};
}

export async function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  if (access || !refresh) return NextResponse.next();

  let tokens: {
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  } | null = null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...forwardVisitor(request) },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: "no-store",
    });
    if (res.ok) tokens = await res.json();
  } catch {
    // API unreachable: leave cookies alone and let the page decide.
    return NextResponse.next();
  }

  if (!tokens) {
    const response = NextResponse.next();
    response.cookies.delete(REFRESH);
    return response;
  }

  // Let this very request see the new access token too.
  request.cookies.set(ACCESS, tokens.accessToken);
  request.cookies.set(REFRESH, tokens.refreshToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(ACCESS, tokens.accessToken, {
    ...options,
    maxAge: maxAge(tokens.accessTokenExpiresAt),
  });
  response.cookies.set(REFRESH, tokens.refreshToken, {
    ...options,
    maxAge: maxAge(tokens.refreshTokenExpiresAt),
  });
  return response;
}

export const config = {
  // Pages only: skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

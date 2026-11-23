import { timingSafeEqual } from 'node:crypto';

/** Header the web server sets on its API calls: the IP of the person using the website. */
export const CLIENT_IP_HEADER = 'x-client-ip';
/** Header proving a call comes from our web server (same value as WEB_PROXY_SECRET). */
export const PROXY_SECRET_HEADER = 'x-proxy-secret';

interface RequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Who a request is for, for per-IP rate limits. When hosted, every website request reaches the
 * API from the web server (Vercel), so all visitors would share one limit. The web server
 * therefore forwards the visitor's IP, and the API believes it only together with the shared
 * secret. Everyone else (the mobile app, direct calls) is identified by `request.ip`, which
 * reads X-Forwarded-For when TRUST_PROXY is set (main.ts).
 */
export function clientIp(req: RequestLike, proxySecret: string): string {
  const forwarded = first(req.headers[CLIENT_IP_HEADER]);
  const secret = first(req.headers[PROXY_SECRET_HEADER]);
  if (forwarded && proxySecret && secret && sameSecret(secret, proxySecret)) {
    return forwarded;
  }
  return req.ip ?? 'unknown';
}

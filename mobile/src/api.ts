import { storage } from './storage';
import { fromByteArray } from 'base64-js';
import type { AuthTokens } from '@csh/shared';

const BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const KEY = 'wathiq.session';
let tokens: AuthTokens | null = null;
let refresh: Promise<void> | null = null;
let generation = 0;
let writes: Promise<void> = Promise.resolve();
let expired: () => void = () => {};
export function onExpired(fn: () => void) {
  expired = fn;
}
function valid(value: unknown): value is AuthTokens {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    ['accessToken', 'refreshToken'].every(
      (k) => typeof v[k] === 'string' && v[k],
    ) &&
    ['accessTokenExpiresAt', 'refreshTokenExpiresAt'].every(
      (k) =>
        typeof v[k] === 'string' && Number.isFinite(Date.parse(v[k] as string)),
    )
  );
}
function persist(epoch: number, value: AuthTokens | null) {
  const operation = writes
    .catch(() => {})
    .then(async () => {
      if (generation !== epoch) return;
      if (value) await storage.set(KEY, JSON.stringify(value));
      else await storage.remove(KEY);
    });
  writes = operation;
  return operation;
}
export async function restoreSession() {
  const epoch = generation;
  const saved = await storage.get(KEY);
  if (generation !== epoch) return !!tokens;
  if (saved) {
    let value: unknown;
    try {
      value = JSON.parse(saved);
    } catch {
      value = null;
    }
    if (valid(value)) tokens = value;
    else await clearSession();
  }
  return !!tokens;
}
export async function setSession(value: AuthTokens) {
  if (!valid(value)) throw new Error('استجابة جلسة غير صالحة من الخادم.');
  const epoch = ++generation;
  tokens = value;
  try {
    await persist(epoch, value);
  } catch (error) {
    if (generation === epoch) {
      tokens = null;
      generation++;
    }
    throw error;
  }
}
export async function clearSession() {
  tokens = null;
  const epoch = ++generation;
  await persist(epoch, null);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
// Normal requests give up after 30 s; uploads and downloads get longer on slow connections.
const TIMEOUT_MS = 30_000;
const LONG_TIMEOUT_MS = 180_000;
async function send(
  path: string,
  init: RequestInit,
  token?: string,
  timeoutMs = TIMEOUT_MS,
) {
  if (!BASE)
    throw new Error(
      'أضف عنوان الخادم إلى EXPO_PUBLIC_API_URL ثم أعد تشغيل التطبيق.',
    );
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string')
    headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function renew() {
  if (!refresh) {
    const epoch = generation;
    const current = tokens;
    refresh = (async () => {
      if (!current) throw new ApiError(401, 'سجّل الدخول للمتابعة.');
      const res = await send('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401 && generation === epoch) {
          await clearSession();
          expired();
        }
        throw new ApiError(res.status, 'تعذّر تجديد الجلسة. حاول مجدداً.');
      }
      const next: unknown = await res.json();
      if (!valid(next)) throw new Error('استجابة جلسة غير صالحة من الخادم.');
      if (generation !== epoch) throw new ApiError(401, 'انتهت الجلسة.');
      tokens = next;
      await persist(epoch, next);
    })().finally(() => {
      refresh = null;
    });
  }
  return refresh;
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  anonymous = false,
): Promise<T> {
  const epoch = generation;
  if (
    !anonymous &&
    tokens &&
    Date.parse(tokens.accessTokenExpiresAt) < Date.now() + 30000
  )
    await renew();
  if (!anonymous && generation !== epoch)
    throw new ApiError(401, 'انتهت الجلسة.');
  const init = {
    method,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  };
  const timeoutMs = body instanceof FormData ? LONG_TIMEOUT_MS : TIMEOUT_MS;
  const used = anonymous ? undefined : tokens?.accessToken;
  let res = await send(path, init, used, timeoutMs);
  if (!anonymous && generation !== epoch)
    throw new ApiError(401, 'انتهت الجلسة.');
  if (res.status === 401 && !anonymous && tokens) {
    if (tokens.accessToken === used) await renew();
    if (generation !== epoch) throw new ApiError(401, 'انتهت الجلسة.');
    res = await send(path, init, tokens?.accessToken, timeoutMs);
  }
  if (!anonymous && generation !== epoch)
    throw new ApiError(401, 'انتهت الجلسة.');
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    throw new ApiError(
      res.status,
      Array.isArray(error.message)
        ? error.message.join('\n')
        : (error.message ?? 'تعذّر إتمام الطلب.'),
    );
  }
  if (res.status === 204) return undefined as T;
  const content = await res.text();
  return content ? (JSON.parse(content) as T) : (undefined as T);
}
export async function downloadAuthenticated(path: string, targetUri: string) {
  if (!BASE)
    throw new Error(
      'أضف عنوان الخادم إلى EXPO_PUBLIC_API_URL ثم أعد تشغيل التطبيق.',
    );
  if (!tokens) throw new ApiError(401, 'سجّل الدخول للمتابعة.');
  // Same session handling as api(): renew a token that is about to expire, retry once on 401.
  const epoch = generation;
  if (Date.parse(tokens.accessTokenExpiresAt) < Date.now() + 30000)
    await renew();
  if (generation !== epoch) throw new ApiError(401, 'انتهت الجلسة.');
  const used = tokens?.accessToken;
  let result = await send(path, {}, used, LONG_TIMEOUT_MS);
  if (result.status === 401 && tokens) {
    if (tokens.accessToken === used) await renew();
    if (generation !== epoch) throw new ApiError(401, 'انتهت الجلسة.');
    result = await send(path, {}, tokens?.accessToken, LONG_TIMEOUT_MS);
  }
  if (!result.ok) throw new ApiError(result.status, 'تعذّر تنزيل الملف.');
  const bytes = new Uint8Array(await result.arrayBuffer());
  const base64 = fromByteArray(bytes);
  const { writeAsStringAsync, EncodingType } =
    await import('expo-file-system/legacy');
  await writeAsStringAsync(targetUri, base64, {
    encoding: EncodingType.Base64,
  });
  return targetUri;
}
export async function logout() {
  const current = tokens;
  await clearSession();
  if (current)
    await api(
      '/auth/logout',
      'POST',
      { refreshToken: current.refreshToken },
      true,
    );
}
export function appendFile(
  form: FormData,
  key: string,
  file: { uri: string; name: string; mimeType?: string },
) {
  form.append(key, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as unknown as Blob);
}

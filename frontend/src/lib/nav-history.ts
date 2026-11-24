/**
 * The in-app page the user was on before the current one (path + query), or null after a full
 * page load. Kept by NavProgress, which sees every URL change. Browser-only state.
 */
let previous: string | null = null;
let current: string | null = null;

export function recordUrl(url: string) {
  if (url === current) return;
  previous = current;
  current = url;
}

export function previousUrl(): string | null {
  return previous;
}

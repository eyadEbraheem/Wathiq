// Shapes every API response follows (see docs/CONVENTIONS.md, "Mobile-ready backend rules").

/** Error body returned by every failing request. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

/** Page metadata returned by every list endpoint. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Body returned by every list endpoint. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export const API_PREFIX = '/api/v1';

/** GET/POST /users/me/cv/share: the public link of a volunteer CV (web page /cv/share/<token>). */
export interface CvShare {
  enabled: boolean;
  /** Secret part of the link; null while the CV is not shared. */
  token: string | null;
  /**
   * Signed copy of the public CV for the QR (`<link>#o=<offline>`), so the Wathiq app can show
   * it without internet. null while not shared or when the server has no signing key.
   */
  offline: string | null;
}

/** What the access token carries. Set on `request.user` by JwtAuthGuard. */
export interface AuthUser {
  id: number;
  email: string | null;
}

/** JWT payload of an access token. */
export interface AccessTokenPayload {
  sub: number;
  email: string | null;
}

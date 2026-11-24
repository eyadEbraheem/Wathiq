import { Transform } from 'class-transformer';

export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export const TrimLower = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** E.164, e.g. +9639XXXXXXXX. */
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export const PASSWORD_MIN = 8;
// bcrypt ignores everything after 72 bytes.
export const PASSWORD_MAX = 72;

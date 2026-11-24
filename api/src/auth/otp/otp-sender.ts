import type { Locale, OtpChannel } from '@prisma/client';

export type OtpReason = 'SIGNUP' | 'CONTACT_VERIFY' | 'PASSWORD_RESET';

export interface OtpMessage {
  channel: OtpChannel;
  /** Email address or E.164 phone number. */
  target: string;
  code: string;
  reason: OtpReason;
  locale: Locale;
  expiresInMinutes: number;
}

/**
 * Delivers one-time codes. One implementation per environment / provider; the auth flow only
 * depends on this class (it doubles as the Nest injection token).
 */
export abstract class OtpSender {
  abstract send(message: OtpMessage): Promise<void>;
}

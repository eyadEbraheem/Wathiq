import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Code generation, hashing and the OTP limits from config. Codes are never stored in clear. */
@Injectable()
export class OtpService {
  readonly ttlMinutes: number;
  readonly resendCooldownSeconds: number;
  readonly maxAttempts: number;
  readonly smsEnabled: boolean;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
    this.ttlMinutes = Number(config.get('OTP_TTL_MINUTES') ?? 10);
    this.resendCooldownSeconds = Number(
      config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 60,
    );
    this.maxAttempts = Number(config.get('OTP_MAX_ATTEMPTS') ?? 5);
    this.smsEnabled = config.get<string>('OTP_SMS_ENABLED') === 'true';
  }

  /** A 6-digit code, zero-padded. */
  generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hash(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }

  matches(code: string, hash: string): boolean {
    const a = Buffer.from(this.hash(code), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  expiresAt(from: Date = new Date()): Date {
    return new Date(from.getTime() + this.ttlMinutes * 60_000);
  }

  /** When a code expiring at `expiresAt` may be resent (codes are sent at expiresAt - TTL). */
  resendAvailableAt(expiresAt: Date): Date {
    const sentAt = expiresAt.getTime() - this.ttlMinutes * 60_000;
    return new Date(sentAt + this.resendCooldownSeconds * 1000);
  }
}

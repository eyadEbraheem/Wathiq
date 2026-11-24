import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

/** Version of the offline CV format; bump it when the fields below change. */
export const OFFLINE_CV_VERSION = 1;

/**
 * The longest signed copy put in a QR (characters). With the page address in front, the QR
 * stays scannable when printed; badges are dropped from the end until it fits.
 */
export const OFFLINE_CV_MAX_LENGTH = 1500;

/**
 * The offline copy of a shared CV, with short keys to keep the QR small. Personal fields are
 * already filtered by the owner's privacy settings (same as the public link).
 *
 * - `v` format version, `t` the share token, `at` when the copy was made (ISO 8601 UTC)
 * - `p` person: `n` name, `g` governorate, `c` city, `e` education level, `f` field of study,
 *   `w` work field
 * - `s` stats: `e` completed events, `h` volunteer hours, `b` approved badges
 * - `b` badges: [title, YYYY-MM-DD, organizer, section (Arabic), role or "", "B" badge | "C"
 *   certificate]; `n` how many badges are included (the newest first)
 * - `m` teams: [team, role, startYear or 0, endYear or 0]
 * - `i` impact: [label, total]
 */
export interface OfflineCv {
  v: number;
  t: string;
  at: string;
  p: {
    n: string;
    g: string | null;
    c: string;
    e: string | null;
    f: string;
    w: string;
  };
  s: { e: number; h: number; b: number };
  b: [string, string, string, string, string, 'B' | 'C'][];
  n: number;
  m: [string, string, number, number][];
  i: [string, number][];
}

/**
 * Signs offline copies of shared CVs with Ed25519, so the Wathiq app can show and trust one
 * without internet: the payload is the raw-deflated JSON, the signature covers those bytes, and
 * the app checks it with the public key (`GET /cv/signing-key`, also built into the app).
 *
 * The private key comes from `CV_SIGNING_PRIVATE_KEY` (base64 PKCS#8 DER). Without it the
 * feature is off: shared links still work online, only the offline copy is missing.
 */
@Injectable()
export class CvSigner {
  private readonly logger = new Logger(CvSigner.name);
  private readonly privateKey: KeyObject | null;
  private readonly publicKeyB64: string | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CV_SIGNING_PRIVATE_KEY')?.trim();
    if (!raw) {
      this.privateKey = null;
      this.publicKeyB64 = null;
      this.logger.warn(
        'CV_SIGNING_PRIVATE_KEY is not set: shared CVs have no offline copy.',
      );
      return;
    }
    this.privateKey = createPrivateKey({
      key: Buffer.from(raw, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    if (this.privateKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('CV_SIGNING_PRIVATE_KEY must be an Ed25519 key.');
    }
    // The raw 32-byte public key: the last 32 bytes of its SPKI DER form.
    const spki = createPublicKey(this.privateKey).export({
      format: 'der',
      type: 'spki',
    });
    this.publicKeyB64 = spki.subarray(spki.length - 32).toString('base64');
  }

  get enabled(): boolean {
    return this.privateKey !== null;
  }

  /** The raw Ed25519 public key (32 bytes, base64), or null when signing is off. */
  get publicKey(): string | null {
    return this.publicKeyB64;
  }

  /**
   * `<deflated JSON, base64url>.<signature, base64url>`, or null when signing is off.
   * Drops badges from the end (oldest) until it fits in OFFLINE_CV_MAX_LENGTH.
   */
  signCopy(copy: OfflineCv): string | null {
    if (!this.privateKey) return null;
    for (let count = copy.b.length; count >= 0; count--) {
      const payload = deflateRawSync(
        Buffer.from(
          JSON.stringify({ ...copy, b: copy.b.slice(0, count), n: count }),
        ),
      );
      const signature = sign(null, payload, this.privateKey);
      const value = `${payload.toString('base64url')}.${signature.toString('base64url')}`;
      if (value.length <= OFFLINE_CV_MAX_LENGTH || count === 0) return value;
    }
    return null;
  }
}

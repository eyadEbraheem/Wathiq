import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  AllowedMimeType,
  detectMimeType,
  FILE_TYPES,
} from 'src/storage/file-type';
import { StorageDriver } from 'src/storage/storage-driver';

export type Visibility = 'public' | 'private';

/** Minimal shape of an uploaded file (what Multer gives a controller). */
export interface IncomingFile {
  buffer: Buffer;
  size: number;
}

export interface StoredFile {
  key: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
}

export interface SaveOptions {
  visibility: Visibility;
  allowed: AllowedMimeType[];
  maxBytes: number;
}

/** Images accepted for posts, cases and avatars. */
export const IMAGE_MIME_TYPES: AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const KEY_PATTERN = /^(public|private)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

/**
 * Upload rules for the whole API:
 * - The API checks the real file type from its bytes, generates the name, and stores it.
 * - Public files (post photos, avatars) get a stable URL.
 * - Private files (ID documents) are only reachable through a short-lived signed URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly apiUrl: string;
  private readonly signingSecret: string;

  constructor(
    private readonly driver: StorageDriver,
    config: ConfigService,
  ) {
    this.apiUrl = config
      .getOrThrow<string>('API_PUBLIC_URL')
      .replace(/\/+$/, '');
    this.signingSecret = config.getOrThrow<string>('STORAGE_SIGNING_SECRET');
  }

  async save(file: IncomingFile, options: SaveOptions): Promise<StoredFile> {
    if (file.size === 0) {
      throw new BadRequestException('The file is empty.');
    }
    if (file.size > options.maxBytes) {
      throw new BadRequestException(
        `The file is too large (max ${Math.floor(options.maxBytes / 1024 / 1024)} MB).`,
      );
    }
    const mimeType = detectMimeType(file.buffer);
    if (!mimeType || !options.allowed.includes(mimeType)) {
      throw new BadRequestException('This file type is not allowed.');
    }

    const key = `${options.visibility}/${randomUUID()}.${FILE_TYPES[mimeType].ext}`;
    await this.driver.put(key, file.buffer, mimeType);
    this.logger.log(`Stored ${key} (${file.size} bytes).`);
    return { key, mimeType, sizeBytes: file.size };
  }

  /**
   * Checks that `key` is an existing public image uploaded through POST /uploads/images and
   * returns what a post needs to store. Throws 400 otherwise.
   */
  async requirePublicImage(
    key: string,
  ): Promise<{ key: string; url: string; mimeType: AllowedMimeType }> {
    const match = /^public\/[0-9a-f-]{36}\.(jpg|png|webp)$/.exec(key);
    const file = match ? await this.read(key) : null;
    if (!file || !IMAGE_MIME_TYPES.includes(file.mimeType)) {
      throw new BadRequestException(`Unknown image: ${key}.`);
    }
    return { key, url: this.publicUrl(key), mimeType: file.mimeType };
  }

  /**
   * Copies a public image into a new file with its own key, so two posts never share a file
   * (removing an image from one post deletes its file). null when the source is gone.
   */
  async copyPublicImage(
    key: string,
  ): Promise<{ key: string; url: string; mimeType: AllowedMimeType } | null> {
    const file = key.startsWith('public/') ? await this.read(key) : null;
    if (!file || !IMAGE_MIME_TYPES.includes(file.mimeType)) return null;
    const copy = `public/${randomUUID()}.${FILE_TYPES[file.mimeType].ext}`;
    await this.driver.put(copy, file.body, file.mimeType);
    this.logger.log(`Copied ${key} to ${copy}.`);
    return { key: copy, url: this.publicUrl(copy), mimeType: file.mimeType };
  }

  async delete(key: string): Promise<void> {
    if (!KEY_PATTERN.test(key)) return;
    await this.driver.delete(key);
    this.logger.log(`Deleted ${key}.`);
  }

  /** Stable URL of a public file. */
  publicUrl(key: string): string {
    const name = this.nameOf(key, 'public');
    return `${this.apiUrl}/api/v1/files/public/${name}`;
  }

  /** URL of a private file, valid for `ttlSeconds`. */
  signedUrl(key: string, ttlSeconds = 300): string {
    const name = this.nameOf(key, 'private');
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(name, expires);
    return `${this.apiUrl}/api/v1/files/private/${name}?expires=${expires}&signature=${signature}`;
  }

  /**
   * The bytes of a public image given by its URL (as `publicUrl` makes it), e.g. a section
   * logo. null when the URL is not one of our public files or the file is not an image.
   */
  async readPublicImageByUrl(url: string) {
    const prefix = `${this.apiUrl}/api/v1/files/public/`;
    if (!url.startsWith(prefix)) return null;
    const file = await this.readPublic(url.slice(prefix.length));
    return file && IMAGE_MIME_TYPES.includes(file.mimeType) ? file : null;
  }

  /** Reads a file for the files controller; null when missing or the signature is bad. */
  async readPublic(name: string) {
    return this.read(`public/${name}`);
  }

  async readPrivate(name: string, expires: number, signature: string) {
    if (!Number.isInteger(expires) || expires < Date.now() / 1000) return null;
    const expected = Buffer.from(this.sign(name, expires), 'hex');
    const given = Buffer.from(signature, 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }
    return this.read(`private/${name}`);
  }

  private async read(key: string) {
    if (!KEY_PATTERN.test(key)) return null;
    const body = await this.driver.get(key);
    if (!body) return null;
    const ext = key.split('.').pop();
    const mimeType = (Object.keys(FILE_TYPES) as AllowedMimeType[]).find(
      (m) => FILE_TYPES[m].ext === ext,
    );
    return mimeType ? { body, mimeType } : null;
  }

  private nameOf(key: string, visibility: Visibility): string {
    if (!KEY_PATTERN.test(key) || !key.startsWith(`${visibility}/`)) {
      throw new Error(`Not a ${visibility} storage key: ${key}`);
    }
    return key.slice(visibility.length + 1);
  }

  private sign(name: string, expires: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${name}:${expires}`)
      .digest('hex');
  }
}

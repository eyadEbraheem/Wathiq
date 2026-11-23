import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriver } from 'src/storage/storage-driver';
import {
  amzDate,
  EMPTY_SHA256,
  encodeS3Path,
  payloadSha256,
  type S3Credentials,
  signS3Request,
} from 'src/storage/s3-signature';

const TIMEOUT_MS = 20_000;

/**
 * Production driver: files in an S3-compatible bucket (Cloudflare R2, AWS S3, Backblaze B2,
 * MinIO, ...), so they survive redeploys on hosts whose disk is wiped (Render). The bucket
 * stays private: clients still get files through the API (`/files/public/...` and signed
 * links), exactly as with the local driver. Plain `fetch` with a hand-written Signature V4,
 * no SDK (docs/OUTSIDE-BOOTCAMP.md).
 */
@Injectable()
export class S3StorageDriver extends StorageDriver {
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly endpoint: URL;
  private readonly bucket: string;
  private readonly credentials: S3Credentials;

  constructor(config: ConfigService) {
    super();
    this.endpoint = new URL(config.getOrThrow<string>('S3_ENDPOINT'));
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.credentials = {
      accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
      // R2 uses "auto"; AWS needs the bucket's region.
      region: config.get<string>('S3_REGION') || 'auto',
    };
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<void> {
    const res = await this.send('PUT', key, body, { 'content-type': mimeType });
    if (!res.ok) throw await this.failure('upload', key, res);
  }

  async get(key: string): Promise<Buffer | null> {
    const res = await this.send('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw await this.failure('read', key, res);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.send('DELETE', key);
    // S3 answers 204 whether or not the object existed.
    if (!res.ok && res.status !== 404)
      throw await this.failure('delete', key, res);
  }

  private async send(
    method: 'GET' | 'PUT' | 'DELETE',
    key: string,
    body?: Buffer,
    extra: Record<string, string> = {},
  ): Promise<Response> {
    // Path-style URL (https://endpoint/bucket/key): works with every S3-compatible service.
    const basePath = this.endpoint.pathname.replace(/\/+$/, '');
    const path = `${basePath}/${this.bucket}/${key}`;
    const payloadHash = body ? payloadSha256(body) : EMPTY_SHA256;
    const date = new Date();
    const headers: Record<string, string> = {
      host: this.endpoint.host,
      'x-amz-date': amzDate(date),
      'x-amz-content-sha256': payloadHash,
      ...extra,
    };
    const authorization = signS3Request({
      method,
      path,
      headers,
      payloadHash,
      credentials: this.credentials,
      date,
    });
    // fetch sets Host itself from the URL.
    const { host: _host, ...sent } = headers;
    void _host;
    return fetch(`${this.endpoint.origin}${encodeS3Path(path)}`, {
      method,
      headers: { ...sent, authorization },
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  /** The S3 error body names the problem (bad key, missing bucket); never contains secrets. */
  private async failure(action: string, key: string, res: Response) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    this.logger.error(
      `S3 ${action} of ${key} failed (${res.status}): ${detail}`,
    );
    return new Error(
      `File storage ${action} failed with status ${res.status}.`,
    );
  }
}

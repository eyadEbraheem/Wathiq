import { createHash, createHmac } from 'node:crypto';

/** SHA-256 of an empty body, sent with GET and DELETE. */
export const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const sha256 = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();

/** S3 escapes every byte except unreserved characters, and keeps "/" in object paths. */
export const encodeS3Path = (path: string) =>
  path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');

/** 20130524T000000Z */
export const amzDate = (date: Date) =>
  date.toISOString().replace(/[:-]|\.\d{3}/g, '');

/**
 * AWS Signature Version 4 for one S3 request (no query string). Returns the Authorization
 * header. `headers` are the headers to sign, with lower-case names; they must include host,
 * x-amz-date and x-amz-content-sha256. Spec: docs.aws.amazon.com, "Signature Version 4".
 */
export function signS3Request(input: {
  method: string;
  path: string;
  headers: Record<string, string>;
  payloadHash: string;
  credentials: S3Credentials;
  date: Date;
}): string {
  const { method, path, headers, payloadHash, credentials, date } = input;
  const stamp = amzDate(date);
  const day = stamp.slice(0, 8);
  const names = Object.keys(headers)
    .map((n) => n.toLowerCase())
    .sort();
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k.toLowerCase(),
      v.trim().replace(/\s+/g, ' '),
    ]),
  );

  const canonicalRequest = [
    method,
    encodeS3Path(path),
    '', // no query string
    names.map((n) => `${n}:${lower[n]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');

  const scope = `${day}/${credentials.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, day);
  const kRegion = hmac(kDate, credentials.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');

  return `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
}

export const payloadSha256 = sha256;

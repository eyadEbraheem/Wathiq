/**
 * Where uploaded files physically live. Feature code never uses a driver directly; it goes
 * through StorageService. LocalStorageDriver (a folder, development) or S3StorageDriver (an
 * S3-compatible bucket, hosting), chosen with STORAGE_DRIVER in storage.module.ts.
 */
export abstract class StorageDriver {
  abstract put(key: string, body: Buffer, mimeType: string): Promise<void>;
  abstract get(key: string): Promise<Buffer | null>;
  abstract delete(key: string): Promise<void>;
}

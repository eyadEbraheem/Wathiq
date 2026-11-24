/**
 * Where uploaded files physically live. Feature code never uses a driver directly; it goes
 * through StorageService. Today only LocalStorageDriver exists (development). An
 * S3-compatible driver is added once a hosting provider is chosen (docs/OUTSIDE-BOOTCAMP.md).
 */
export abstract class StorageDriver {
  abstract put(key: string, body: Buffer, mimeType: string): Promise<void>;
  abstract get(key: string): Promise<Buffer | null>;
  abstract delete(key: string): Promise<void>;
}

import { INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { StorageService } from 'src/storage/storage.service';
import { createTestApp } from './utils/test-app';

// Smallest valid-looking files: only the leading bytes matter for type detection.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const PDF = Buffer.from('%PDF-1.7\n%test\n');
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);

describe('Storage (e2e)', () => {
  let app: INestApplication;
  let storage: StorageService;
  const http = () => request(app.getHttpServer());
  const MB = 1024 * 1024;

  /** Path part of a URL built by StorageService. */
  const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    storage = app.get(StorageService);
  });

  afterAll(async () => {
    await app.close();
    await rm(process.env.STORAGE_LOCAL_DIR ?? './storage-test', {
      recursive: true,
      force: true,
    });
  });

  it('stores a public image and serves it at a stable URL', async () => {
    const stored = await storage.save(
      { buffer: PNG, size: PNG.length },
      { visibility: 'public', allowed: ['image/png'], maxBytes: MB },
    );
    expect(stored.key).toMatch(/^public\/[0-9a-f-]{36}\.png$/);

    const res = await http()
      .get(pathOf(storage.publicUrl(stored.key)))
      .expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
  });

  it('detects the type from the bytes, not the name, and enforces limits', async () => {
    await expect(
      storage.save(
        { buffer: EXE, size: EXE.length },
        { visibility: 'public', allowed: ['image/png'], maxBytes: MB },
      ),
    ).rejects.toThrow('This file type is not allowed.');
    await expect(
      storage.save(
        { buffer: PDF, size: PDF.length },
        { visibility: 'public', allowed: ['image/png'], maxBytes: MB },
      ),
    ).rejects.toThrow('This file type is not allowed.');
    await expect(
      storage.save(
        { buffer: PNG, size: 2 * MB },
        { visibility: 'public', allowed: ['image/png'], maxBytes: MB },
      ),
    ).rejects.toThrow('too large');
  });

  it('serves a private file only through a valid, unexpired signed URL', async () => {
    const stored = await storage.save(
      { buffer: PDF, size: PDF.length },
      { visibility: 'private', allowed: ['application/pdf'], maxBytes: MB },
    );
    const name = stored.key.replace('private/', '');

    // No public access, no unsigned access.
    await http().get(`/api/v1/files/public/${name}`).expect(404);
    await http().get(`/api/v1/files/private/${name}`).expect(404);

    const url = pathOf(storage.signedUrl(stored.key, 60));
    const ok = await http().get(url).expect(200);
    expect(ok.headers['content-type']).toBe('application/pdf');
    expect(ok.headers['cache-control']).toBe('private, no-store');

    // Tampered signature and expired link are refused.
    const tampered = url.replace(/signature=(.)/, (_m, c: string) =>
      c === '0' ? 'signature=1' : 'signature=0',
    );
    await http().get(tampered).expect(404);
    await http()
      .get(pathOf(storage.signedUrl(stored.key, -1)))
      .expect(404);
  });

  it('deletes files', async () => {
    const stored = await storage.save(
      { buffer: PNG, size: PNG.length },
      { visibility: 'public', allowed: ['image/png'], maxBytes: MB },
    );
    await storage.delete(stored.key);
    await http()
      .get(pathOf(storage.publicUrl(stored.key)))
      .expect(404);
  });

  it('rejects names that are not storage keys', async () => {
    await http().get('/api/v1/files/public/..%2F..%2F.env').expect(404);
    await http().get('/api/v1/files/public/not-a-key.png').expect(404);
  });
});

import { Logger } from '@nestjs/common';
import { detectMimeType } from 'src/storage/file-type';
import type { StorageService } from 'src/storage/storage.service';

const logger = new Logger('CvPdfImages');

/** A logo bigger than this is skipped: it is shown 30 px wide. */
const MAX_LOGO_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const SVG = 'image/svg+xml';

const dataUri = (mimeType: string, body: Buffer) =>
  `data:${mimeType};base64,${body.toString('base64')}`;

/**
 * Section logos (`Section.logoUrl`, also the badge image) as `data:` URIs, keyed by URL, so
 * the PDF page shows them without Chrome loading anything (it may only reach Google Fonts).
 * Our own stored files are read from storage; other http(s) URLs (set by admins, e.g. an SVG
 * on the web site) are downloaded once per PDF. A logo that is missing, too big or not an
 * image is left out and the badge prints without it.
 */
export async function loadSectionLogos(
  urls: string[],
  storage: StorageService,
): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((url) => url.trim() !== ''))];
  const logos = new Map<string, string>();
  await Promise.all(
    unique.map(async (url) => {
      try {
        const logo = await loadLogo(url, storage);
        if (logo) logos.set(url, logo);
        else logger.warn(`Section logo skipped (not a usable image): ${url}`);
      } catch (error) {
        logger.warn(`Section logo failed to load: ${url} (${String(error)})`);
      }
    }),
  );
  return logos;
}

async function loadLogo(
  url: string,
  storage: StorageService,
): Promise<string | null> {
  const stored = await storage.readPublicImageByUrl(url);
  if (stored) return dataUri(stored.mimeType, stored.body);
  if (!/^https?:\/\//i.test(url)) return null;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) return null;
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_LOGO_BYTES) return null;
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0 || body.length > MAX_LOGO_BYTES) return null;

  // The type comes from the bytes for pictures; SVG is text, so from the header and its tag.
  const detected = detectMimeType(body);
  if (detected && detected.startsWith('image/')) return dataUri(detected, body);
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith(SVG) && body.toString('utf8', 0, 1024).includes('<svg')) {
    return dataUri(SVG, body);
  }
  return null;
}

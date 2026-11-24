/** File types the platform accepts, detected from the file's first bytes (not its name). */
export const FILE_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: [[0xff, 0xd8, 0xff]] },
  'image/png': { ext: 'png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
  // RIFF....WEBP
  'image/webp': { ext: 'webp', magic: [[0x52, 0x49, 0x46, 0x46]] },
  'application/pdf': { ext: 'pdf', magic: [[0x25, 0x50, 0x44, 0x46]] },
} as const;

export type AllowedMimeType = keyof typeof FILE_TYPES;

export function detectMimeType(body: Buffer): AllowedMimeType | null {
  for (const [mime, def] of Object.entries(FILE_TYPES) as [
    AllowedMimeType,
    (typeof FILE_TYPES)[AllowedMimeType],
  ][]) {
    const matches = def.magic.some((bytes) =>
      bytes.every((byte, i) => body[i] === byte),
    );
    if (!matches) continue;
    if (
      mime === 'image/webp' &&
      body.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      continue;
    }
    return mime;
  }
  return null;
}

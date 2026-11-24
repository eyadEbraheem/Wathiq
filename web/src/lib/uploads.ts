import "server-only";
import { apiFetch } from "@/lib/api";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sends the images picked in a form to POST /uploads/images, one request each, and returns
 * their storage keys in the same order. Empty file inputs are skipped.
 */
export async function uploadImages(
  files: FormDataEntryValue[],
  token: string,
): Promise<{ keys: string[] } | { error: string }> {
  const images = files.filter((f): f is File => f instanceof File && f.size > 0);
  const keys: string[] = [];
  for (const file of images) {
    if (file.size > MAX_BYTES) return { error: `الصورة «${file.name}» أكبر من 10 ميغابايت.` };
    const body = new FormData();
    body.append("file", file, file.name);
    const res = await apiFetch("/uploads/images", { method: "POST", token, body });
    if (!res.ok) {
      return { error: `تعذّر رفع «${file.name}». الصور المسموحة: JPG أو PNG أو WebP.` };
    }
    keys.push(((await res.json()) as { key: string }).key);
  }
  return { keys };
}

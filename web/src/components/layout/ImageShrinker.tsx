"use client";

import { useEffect } from "react";

/** Longest side after shrinking, and the JPEG quality. A phone photo ends up around 200–400 KB. */
const MAX_SIDE = 1600;
const QUALITY = 0.8;
/** Smaller photos are sent as they are. */
const SHRINK_ABOVE_BYTES = 700 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Forms whose photos are still being shrunk; their submit waits for it. */
const pending = new WeakMap<HTMLFormElement, Promise<void>>();

async function shrink(file: File): Promise<File> {
  if (!IMAGE_TYPES.has(file.type) || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency: paint white first (a PNG QR code stays readable).
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file; // Unreadable here: let the API decide.
  }
}

/**
 * Shrinks big photos in every file field of the site as soon as they are picked, before the
 * form sends them. The host (Vercel) refuses requests above about 4.5 MB, and phone photos are
 * often bigger. PDFs and small images are left alone. A form submitted while photos are still
 * shrinking waits for them, then submits itself.
 */
export function ImageShrinker() {
  useEffect(() => {
    function onChange(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files) return;
      const files = Array.from(input.files);
      if (!files.some((f) => IMAGE_TYPES.has(f.type) && f.size > SHRINK_ABOVE_BYTES)) return;

      const job = Promise.all(files.map(shrink)).then((smaller) => {
        // The person may have picked other files meanwhile: keep the newest choice.
        if (input.files && Array.from(input.files).every((f, i) => f === files[i])) {
          const transfer = new DataTransfer();
          smaller.forEach((f) => transfer.items.add(f));
          input.files = transfer.files;
        }
      });
      const form = input.form;
      if (form) {
        const before = pending.get(form) ?? Promise.resolve();
        const both = Promise.all([before, job]).then(() => undefined);
        pending.set(form, both);
        void both.finally(() => {
          if (pending.get(form) === both) pending.delete(form);
        });
      }
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const job = pending.get(form);
      if (!job) return;
      // Hold this submit (before React sees it) and send the form again once photos are ready.
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = event.submitter;
      void job.then(() => form.requestSubmit(submitter ?? undefined));
    }

    // Capture on window: runs before React's own listeners.
    window.addEventListener("change", onChange, true);
    window.addEventListener("submit", onSubmit, true);
    return () => {
      window.removeEventListener("change", onChange, true);
      window.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}

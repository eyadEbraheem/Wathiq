"use client";

import { useEffect } from "react";

/**
 * Scrolls to the element named in the URL hash (e.g. `#documentation`) once the page has
 * rendered. Next.js may try before a page that streams in behind `loading.tsx` is there.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    // Wait one frame so the page's entrance animation has its final layout.
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}

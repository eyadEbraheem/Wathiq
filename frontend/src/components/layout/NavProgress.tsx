"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { recordUrl } from "@/lib/nav-history";

/** pending: a link was clicked, but the bar waits a moment so instant pages never flash it. */
type Phase = "idle" | "pending" | "loading" | "done";

/**
 * A thin teal bar at the top of the page while the next page loads. It starts when an internal
 * link is clicked and finishes when the URL changes, so the page never looks frozen.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The new page is on screen: fill the bar, then hide it.
  useEffect(() => {
    const query = searchParams.toString();
    recordUrl(query ? `${pathname}?${query}` : pathname);
    setPhase((current) => (current === "loading" ? "done" : current === "pending" ? "idle" : current));
  }, [pathname, searchParams]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (phase === "pending") timer.current = setTimeout(() => setPhase("loading"), 150);
    if (phase === "done") timer.current = setTimeout(() => setPhase("idle"), 400);
    // Never stay stuck if a navigation is cancelled.
    if (phase === "loading") timer.current = setTimeout(() => setPhase("done"), 10_000);
    return () => clearTimeout(timer.current);
  }, [phase]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or only a #section): nothing will load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPhase("pending");
    }
    // Capture phase: Next's <Link> cancels the click before it bubbles up to the document.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-300 print:hidden ${
        phase === "loading" || phase === "done" ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full origin-right bg-teal-grad shadow-glow"
        style={{
          transform: `scaleX(${phase === "loading" ? 0.85 : phase === "done" ? 1 : 0})`,
          transition:
            phase === "loading"
              ? "transform 6s cubic-bezier(0.1, 0.8, 0.2, 1)"
              : phase === "done"
                ? "transform 0.2s ease-out"
                : "none",
        }}
      />
    </div>
  );
}

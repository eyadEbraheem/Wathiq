"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { previousUrl } from "@/lib/nav-history";

/**
 * A "back to …" link. When the user came from a page that `matches`, it goes back in history
 * (instant, same scroll position, same filters). Otherwise it opens `href`.
 */
export function BackLink({
  href,
  matches,
  className,
  children,
}: {
  href: string;
  /** Path of the page this link leads back to, e.g. "/" for any home feed. */
  matches: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const previous = previousUrl();
    if (previous === null || new URL(previous, window.location.origin).pathname !== matches) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link href={href} prefetch onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

/** A sidebar item. The current page gets the teal gradient and the mirrored corners. */
export function NavLink({
  href,
  icon,
  iconTone,
  label,
  count,
}: {
  href: string;
  icon: IconName;
  /** Classes for the icon tile when the item is not active. */
  iconTone: string;
  label: string;
  count?: ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      // Load the whole page ahead of time, so opening it from the sidebar is instant.
      prefetch
      aria-current={active ? "page" : undefined}
      className={`organic organic-sm flex w-full items-center justify-between border px-3 py-2.5 text-xs font-extrabold ${
        active
          ? "flipped border-transparent bg-teal-grad text-white shadow-glow"
          : "border-transparent text-ink hover:bg-icy/60"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
            active ? "bg-white/20 text-white" : iconTone
          }`}
        >
          <Icon name={icon} className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span>{label}</span>
      </span>
      {count !== undefined && count !== null ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
            active ? "bg-white/25 text-white" : "bg-icy text-primary-ink"
          }`}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

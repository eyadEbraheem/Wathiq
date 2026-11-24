import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { CurrentUser } from "@/lib/types";

/** The sticky header: greeting, theme switch, search, notification bell. */
export function TopBar({ user, unread }: { user: CurrentUser | null; unread: number }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-black leading-tight text-ink sm:text-xl">
          {user ? `أهلاً ${user.name.split(" ")[0]}` : "أهلاً بك في واثق"}
        </p>
        <p className="hidden truncate text-[11px] font-bold text-muted sm:block">
          مبادرات وفعاليات تطوعية وحالات إنسانية من فرق وأشخاص موثّقين. لا تمر أي أموال عبر المنصة.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        {user ? (
          <Link
            href="/search"
            prefetch
            className="organic organic-sm flex h-10 w-10 items-center justify-center border border-line bg-canvas text-ink hover:border-primary"
            aria-label="البحث"
          >
            <Icon name="search" />
          </Link>
        ) : null}
        {user ? (
          <Link
            href="/notifications"
            className="organic organic-sm relative flex h-10 w-10 items-center justify-center border border-line bg-canvas text-ink hover:border-primary"
            aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"}
          >
            <Icon name="bell" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-primary px-0.5 text-[9px] font-black text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        ) : (
          <ButtonLink href="/register" size="sm" className="hidden sm:inline-flex">
            انضم إلينا
            <Icon name="arrow" className="h-4 w-4" />
          </ButtonLink>
        )}
      </div>
    </>
  );
}

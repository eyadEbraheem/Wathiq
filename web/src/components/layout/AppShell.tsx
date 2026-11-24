"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { NavProgress } from "@/components/layout/NavProgress";
import { Icon } from "@/components/ui/Icon";

/**
 * The reference layout: a fixed 290px sidebar on the right (RTL) from `lg`, and a drawer that
 * slides in on smaller screens. The sidebar and top bar are server-rendered and passed in.
 */
export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[#13263A]/40 backdrop-blur-[2px] lg:hidden print:hidden"
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[290px] flex-col print:hidden border-l border-line bg-surface shadow-soft transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="القائمة الجانبية"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="organic organic-sm absolute left-4 top-6 flex h-8 w-8 items-center justify-center bg-icy text-ink lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
        {sidebar}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:mr-[290px] print:mr-0">
        <header className="sticky top-0 z-30 border-b print:hidden border-line bg-surface/90 px-4 py-3.5 backdrop-blur-md sm:px-7">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="organic organic-sm flex h-10 w-10 shrink-0 items-center justify-center bg-icy text-ink lg:hidden"
              aria-label="فتح القائمة"
            >
              <Icon name="menu" />
            </button>
            {topbar}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-7 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}

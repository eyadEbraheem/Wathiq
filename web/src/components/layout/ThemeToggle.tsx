"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "theme";

/** Switches the `dark` class on <html> and remembers the choice in this browser. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode or blocked storage: the switch still works for this visit.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="organic organic-sm flex h-10 w-10 items-center justify-center border border-line bg-canvas text-ink hover:border-primary"
      aria-label={dark ? "الوضع الفاتح" : "الوضع الليلي"}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/** Runs before paint so the saved or system theme applies without a flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

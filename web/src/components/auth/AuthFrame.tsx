import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

const POINTS: { icon: IconName; text: string }[] = [
  { icon: "shield", text: "مبادرات وفعاليات من منظمات وأشخاص موثّقين" },
  { icon: "calendar", text: "تطوّع واختر دورك، واحصل على شارة بعد كل فعالية" },
  { icon: "heart", text: "حالات إنسانية بتواصل مباشر، دون أن تمر أي أموال عبر المنصة" },
];

/**
 * The reference's welcome screen: a navy brand panel and a white panel with the
 * "new account / sign in" switcher. Wraps the login and register forms.
 */
export function AuthFrame({ mode, children }: { mode: "login" | "register"; children: ReactNode }) {
  const tab = (on: boolean) =>
    `organic organic-sm flex-1 py-2.5 text-center text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;
  return (
    <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-[36px] border border-line bg-surface shadow-soft-hover lg:grid-cols-2">
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#13263A] via-[#173049] to-[#1E3A56] p-8 text-white sm:p-11">
        <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-environment/20 blur-3xl" />
        <div className="relative space-y-3 pt-2 text-center">
          <div className="emblem mx-auto flex h-20 w-20 items-center justify-center rounded-full font-display text-4xl font-black">
            و
          </div>
          <h1 className="font-display text-2xl font-black sm:text-3xl">أهلاً بك في واثق</h1>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-300">
            منصة العمل المدني والتطوع في سوريا: تطوّع موثّق، شارات، وسيرة تطوعية بشفافية كاملة.
          </p>
        </div>
        <ul className="relative mx-auto my-8 w-full max-w-sm space-y-3">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-xs font-bold leading-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/25 text-primary-light">
                <Icon name={p.icon} className="h-4 w-4" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
        <p className="relative text-center text-[11px] text-slate-300">
          الحساب الجديد حساب عادي، ويُطلب التوثيق لاحقاً لمن ينشر وينظّم.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-6 p-8 sm:p-11">
        <div className="space-y-6">
          <nav className="flex items-center gap-2 rounded-2xl border border-line bg-canvas p-1.5" aria-label="نوع الدخول">
            <Link href="/register" className={tab(mode === "register")} aria-current={mode === "register" ? "page" : undefined}>
              حساب جديد
            </Link>
            <Link href="/login" className={tab(mode === "login")} aria-current={mode === "login" ? "page" : undefined}>
              دخول
            </Link>
          </nav>
          {children}
        </div>
        <div className="border-t border-line/70 pt-5">
          <Link
            href="/"
            className="organic organic-sm inline-flex items-center gap-1.5 border border-line bg-canvas px-4 py-2 text-xs font-extrabold text-ink hover:border-primary"
          >
            استعراض كضيف
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import { saveSpecialtiesAction, suggestSpecialtiesAction } from "@/lib/actions/team";

const initialState: FormState = {};
const MAX = 10;

/**
 * A verified account's specialties (e.g. "تسرّب الأطفال"). People find the account by them in
 * search. While typing, specialties other accounts already use are offered, so the same one is
 * not written in several ways.
 */
export function SpecialtiesForm({ initial }: { initial: string[] }) {
  const [state, formAction, pending] = useActionState(saveSpecialtiesAction, initialState);
  const [names, setNames] = useState(initial);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [, startSearch] = useTransition();

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => setSuggestions(await suggestSpecialtiesAction(q)));
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  function add(name: string) {
    const clean = name.trim();
    if (clean.length < 2 || names.length >= MAX || names.includes(clean)) return;
    setNames([...names, clean]);
    setText("");
    setSuggestions([]);
  }

  const offered = text.trim().length >= 2 ? suggestions.filter((s) => !names.includes(s)) : [];

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <FormMessage error={state.error} notice={state.notice} />
      {names.map((n) => (
        <input key={n} type="hidden" name="names" value={n} />
      ))}
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {names.map((n) => (
            <span key={n} className="flex items-center gap-1.5 rounded-full bg-icy py-1 pe-1.5 ps-3 text-xs font-black text-primary-ink">
              {n}
              <button
                type="button"
                onClick={() => setNames(names.filter((x) => x !== n))}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"
                aria-label={`إزالة ${n}`}
              >
                <Icon name="x" className="h-3 w-3" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs font-semibold text-muted">لا توجد اختصاصات بعد.</p>
      )}
      {names.length < MAX ? (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                id="specialty"
                label="أضف اختصاصاً"
                placeholder="مثلاً: تسرّب الأطفال من المدارس"
                value={text}
                maxLength={80}
                autoComplete="off"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add(text);
                  }
                }}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => add(text)} disabled={text.trim().length < 2}>
              إضافة
            </Button>
          </div>
          {offered.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] font-bold text-muted">مستخدمة من جمعيات أخرى:</span>
              {offered.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => add(s)}
                  className="rounded-full border border-line bg-canvas px-3 py-1 text-[11px] font-extrabold text-ink hover:border-primary"
                >
                  + {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] font-bold text-muted">وصلت إلى الحد الأقصى ({MAX} اختصاصات).</p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "حفظ الاختصاصات"}
      </Button>
    </form>
  );
}

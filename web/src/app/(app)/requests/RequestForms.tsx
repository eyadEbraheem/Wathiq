"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { choose } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import { decideIncomingRequestAction, sendPublishRequestAction } from "@/lib/actions/requests";
import { sectionLook } from "@/lib/sections";
import type { Section } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

const fileClasses =
  "block w-full text-xs font-bold text-muted file:me-3 file:rounded-xl file:border-0 file:bg-icy file:px-4 file:py-2 file:text-xs file:font-black file:text-primary-ink";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-semibold text-muted">{hint}</span> : null}
    </label>
  );
}

/** The request itself; `targetUserId` = a verified account, or none = the platform. */
export function RequestForm({ sections, targetUserId }: { sections: Section[]; targetUserId?: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendPublishRequestAction, {});
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? 0);
  const [withCase, setWithCase] = useState(false);
  const humanitarian = sections.find((s) => s.id === sectionId)?.slug === "humanitarian";
  if (state.notice) return <FormMessage notice={state.notice} />;

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      {targetUserId ? <input type="hidden" name="targetUserId" value={targetUserId} /> : null}
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <legend className="mb-1.5 text-xs font-black text-ink">القسم</legend>
        {sections.map((s) => {
          const look = sectionLook(s.slug);
          const on = s.id === sectionId;
          return (
            <label
              key={s.id}
              className={`organic flex cursor-pointer items-center gap-2 border-2 p-2.5 text-xs font-black text-ink ${
                on ? `flipped ${look.chosen}` : look.soft
              }`}
            >
              <input
                type="radio"
                name="sectionId"
                value={s.id}
                checked={on}
                onChange={() => {
                  setSectionId(s.id);
                  setWithCase(false);
                }}
                className="sr-only"
              />
              <span className={`h-3 w-3 rounded-full ${look.solid}`} />
              {s.nameAr}
            </label>
          );
        })}
      </fieldset>
      <Field label="العنوان">
        <input name="title" required minLength={3} maxLength={150} className={`h-12 ${controlClasses}`} />
      </Field>
      <Field label="النص">
        <textarea name="body" required maxLength={5000} rows={5} className={`py-3 leading-7 ${controlClasses}`} />
      </Field>
      <Field label="صور (اختياري، حتى 10)">
        <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" className={fileClasses} />
      </Field>

      {humanitarian ? (
        <div className="space-y-3 rounded-3xl border border-line bg-canvas/60 p-4">
          <label className="flex items-center gap-2 text-xs font-black text-ink">
            <input
              type="checkbox"
              name="withCase"
              checked={withCase}
              onChange={(e) => setWithCase(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-primary))]"
            />
            هذا الطلب حالة إنسانية تحتاج دعماً مباشراً
          </label>
          {withCase ? (
            <>
              <Field label="رقم للتواصل مع أصحاب الحالة" hint="مثل ‎+963912345678.">
                <input name="contactPhone" required dir="ltr" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="صورة رمز شام كاش (اختياري)">
                <input type="file" name="paymentQr" accept="image/jpeg,image/png,image/webp" className={fileClasses} />
              </Field>
              <Field label="ملاحظة الدفع (اختياري)">
                <input name="paymentNote" maxLength={500} className={`h-12 ${controlClasses}`} />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}

      {!targetUserId ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-black text-ink">باسم من يُنشر؟</legend>
          <label className="flex items-center gap-2 text-xs font-bold text-ink">
            <input type="radio" name="attribution" value="REQUESTER" defaultChecked className="accent-[rgb(var(--c-primary))]" />
            باسمي (يظهر أنه بطلب مني)
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-ink">
            <input type="radio" name="attribution" value="PUBLISHER" className="accent-[rgb(var(--c-primary))]" />
            باسم واثق فقط
          </label>
        </fieldset>
      ) : (
        <p className="text-[11px] font-bold text-muted">الحساب الذي يستلم الطلب يقرر إن كان سيذكر اسمك.</p>
      )}

      <FormMessage error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "أرسل الطلب"}
      </Button>
    </form>
  );
}

/** For the verified account asked: publish under its name, credit the requester, or reject. */
export function IncomingDecision({ id }: { id: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideIncomingRequestAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  const primary =
    "organic organic-sm bg-teal-grad px-3 py-2 text-[11px] font-black text-white shadow-glow disabled:opacity-60";
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="id" value={id} />
      <input name="reason" maxLength={500} placeholder="سبب الرفض (اختياري)" aria-label="سبب الرفض" className={`h-10 ${controlClasses}`} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" onClick={choose("credit")} disabled={pending} className={primary}>
          انشر مع ذكر صاحب الطلب
        </button>
        <button type="submit" onClick={choose("publisher")} disabled={pending} className={primary}>
          انشر باسمي
        </button>
        <button
          type="submit"
          onClick={choose("reject")}
          disabled={pending}
          className="organic organic-sm border border-line bg-canvas px-3 py-2 text-[11px] font-extrabold text-muted disabled:opacity-60"
        >
          رفض
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

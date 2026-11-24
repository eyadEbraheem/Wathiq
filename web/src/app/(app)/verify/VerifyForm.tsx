"use client";

import { ORGANIZATION_PAPERS } from "@csh/shared";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import { requestVerificationAction } from "@/lib/actions/verification";
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

/** The label of organization paper `i`; "الورقة 1", ... until the papers are agreed. */
function paperLabel(i: number): string {
  return ORGANIZATION_PAPERS[i]?.labelAr || `الورقة ${i + 1}`;
}

/**
 * The verification request. `organizationOnly`: the account signed up as an organization, so
 * it can only ask to be verified as one; `foundedAt` pre-fills its founding date.
 */
export function VerifyForm({ organizationOnly = false, foundedAt }: { organizationOnly?: boolean; foundedAt?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestVerificationAction, {});
  const [kind, setKind] = useState<"ORGANIZATION" | "INDIVIDUAL">("ORGANIZATION");
  if (state.notice) return <FormMessage notice={state.notice} />;

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      {organizationOnly ? (
        <input type="hidden" name="kind" value="ORGANIZATION" />
      ) : (
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-xs font-black text-ink">نوع الحساب</legend>
          {(
            [
              ["ORGANIZATION", "منظمة أو فريق", "جمعية، فريق تطوعي، مبادرة"],
              ["INDIVIDUAL", "شخص", "متطوع أو ناشط معروف بعمله"],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`organic cursor-pointer border-2 p-3 text-right ${
                kind === value ? "flipped border-primary bg-icy" : "border-line bg-canvas"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span className="block text-sm font-black text-ink">{label}</span>
              <span className="block text-[11px] font-semibold text-muted">{hint}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="رقم للتواصل معك" hint="بالصيغة الدولية، مثل ‎+963912345678.">
          <input name="contactPhone" required dir="ltr" placeholder="+963912345678" className={`h-12 ${controlClasses}`} />
        </Field>
        {kind === "ORGANIZATION" ? (
          <Field label="تاريخ التأسيس">
            <input name="foundedAt" type="date" required defaultValue={foundedAt} className={`h-12 ${controlClasses}`} />
          </Field>
        ) : null}
      </div>

      <Field label="عرّفنا بعملك التطوعي السابق">
        <textarea
          name="details"
          maxLength={2000}
          rows={4}
          placeholder="فريق تطوعي يعمل في السلمية منذ 2019 في حملات التشجير…"
          className={`py-3 leading-7 ${controlClasses}`}
        />
      </Field>
      <Field label="روابط لأعمالك (اختياري)" hint="صفحة فيسبوك، تقارير، أخبار… رابط في كل سطر، حتى 10.">
        <textarea name="links" rows={2} dir="ltr" placeholder="https://facebook.com/our-team" className={`py-3 leading-7 ${controlClasses}`} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="نوع الوثيقة">
          <select name="idDocumentType" defaultValue="ID_CARD" className={`h-12 ${controlClasses}`}>
            <option value="ID_CARD">بطاقة شخصية</option>
            <option value="PASSPORT">جواز سفر</option>
          </select>
        </Field>
        <Field label={kind === "ORGANIZATION" ? "هوية المسؤول عن الحساب" : "صورة هويتك"} hint="JPG أو PNG أو WebP أو PDF، حتى 10 ميغا.">
          <input type="file" name="idDocument" required accept="image/jpeg,image/png,image/webp,application/pdf" className={fileClasses} />
        </Field>
      </div>
      {kind === "ORGANIZATION" ? (
        <fieldset className="space-y-3 rounded-2xl border border-line bg-canvas p-4">
          <legend className="px-1 text-xs font-black text-ink">أوراق الجمعية (كلها مطلوبة)</legend>
          {ORGANIZATION_PAPERS.map((_, i) => (
            <Field key={i} label={paperLabel(i)}>
              <input
                type="file"
                name={`paper${i}`}
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className={fileClasses}
              />
            </Field>
          ))}
        </fieldset>
      ) : null}
      <Field label="ملفات داعمة (اختياري، حتى 3)" hint="ترخيص، شهادة، تقرير نشاط…">
        <input type="file" name="supporting" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className={fileClasses} />
      </Field>

      <p className="rounded-2xl bg-icy/70 p-3 text-[11px] font-bold leading-6 text-muted">
        الوثائق تُحفظ بشكل خاص، لا يراها إلا فريق المراجعة في واثق، وتُحذف بعد القرار.
      </p>
      <FormMessage error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "أرسل طلب التوثيق"}
      </Button>
    </form>
  );
}

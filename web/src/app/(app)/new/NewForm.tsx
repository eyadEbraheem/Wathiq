"use client";

import { useActionState, useState, type ReactNode } from "react";
import { GOVERNORATE_LABELS_AR } from "@csh/shared";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import { createEventAction, createPostAction } from "@/lib/actions/create";
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-3xl border border-line bg-canvas/60 p-5">
      <legend className="px-2 font-display text-sm font-black text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Publishing a post or creating an event. Topics follow the chosen section. */
export function NewForm({ kind, sections }: { kind: "post" | "event"; sections: Section[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    kind === "event" ? createEventAction : createPostAction,
    {},
  );
  const [sectionId, setSectionId] = useState<number>(sections[0]?.id ?? 0);
  const [withCase, setWithCase] = useState(false);
  const [withOpportunity, setWithOpportunity] = useState(false);
  const section = sections.find((s) => s.id === sectionId);

  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-5">
      <Panel title="القسم والمواضيع">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                    setWithOpportunity(false);
                  }}
                  className="sr-only"
                />
                <span className={`h-3 w-3 rounded-full ${look.solid}`} />
                {s.nameAr}
              </label>
            );
          })}
        </div>
        {section && section.topics.length > 0 ? (
          <div className="flex flex-wrap gap-2" key={section.id}>
            {section.topics.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink has-[:checked]:border-primary has-[:checked]:bg-icy has-[:checked]:text-primary-ink"
              >
                <input type="checkbox" name="topicIds" value={t.id} className="h-3.5 w-3.5 accent-[rgb(var(--c-primary))]" />
                {t.nameAr}
              </label>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel title={kind === "event" ? "عن الفعالية" : "المنشور"}>
        <Field label="العنوان">
          <input name="title" required minLength={3} maxLength={150} className={`h-12 ${controlClasses}`} />
        </Field>
        <Field label={kind === "event" ? "الوصف: ماذا سنفعل، وماذا يحتاج المتطوع؟" : "النص"}>
          <textarea name="body" required maxLength={5000} rows={6} className={`py-3 leading-7 ${controlClasses}`} />
        </Field>
        <Field label="صور (حتى 10، JPG أو PNG أو WebP، كل صورة حتى 10 ميغا)" hint="الصورة الأولى هي الغلاف.">
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple className={fileClasses} />
        </Field>
      </Panel>

      {kind === "event" ? (
        <>
          <Panel title="الموعد والمكان">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="يبدأ في" hint="بتوقيت سوريا.">
                <input type="datetime-local" name="startsAt" required className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="ينتهي في (اختياري)">
                <input type="datetime-local" name="endsAt" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="آخر موعد للتقديم (اختياري)" hint="بدونه يبقى التقديم مفتوحاً حتى البداية.">
                <input type="datetime-local" name="applicationDeadline" className={`h-12 ${controlClasses}`} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="المحافظة">
                <select name="governorate" required defaultValue="" className={`h-12 ${controlClasses}`}>
                  <option value="">اختر…</option>
                  {Object.entries(GOVERNORATE_LABELS_AR).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المدينة">
                <input name="city" required maxLength={100} className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="المكان بالتفصيل (اختياري)">
                <input name="locationText" maxLength={300} placeholder="الحديقة الشمالية، المدخل الرئيسي" className={`h-12 ${controlClasses}`} />
              </Field>
            </div>
          </Panel>

          <Panel title="المتطوعون">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="ساعات التطوع" hint="تُضاف لحساب كل متطوع مقبول بعد توثيق الفعالية.">
                <input type="number" name="volunteerHours" required min={1} max={500} placeholder="4" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="أقل عمر يوم الفعالية (اختياري)" hint="13 أو أكثر.">
                <input type="number" name="minAge" min={13} max={100} className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="عدد المقاعد (إن لم تستخدم أدواراً)" hint="اتركه فارغاً لعدد غير محدود.">
                <input type="number" name="capacity" min={1} className={`h-12 ${controlClasses}`} />
              </Field>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-ink">أدوار المتطوعين (اختياري)</p>
              <p className="text-[11px] font-semibold text-muted">
                مع الأدوار يصبح عدد المقاعد مجموع مقاعدها، ويختار كل متطوع من 1 إلى 3 أدوار بالترتيب.
              </p>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_110px] gap-2">
                  <input
                    name={`roleName${i}`}
                    maxLength={60}
                    placeholder={i === 0 ? "زراعة" : "اسم الدور"}
                    aria-label={`اسم الدور ${i + 1}`}
                    className={`h-11 ${controlClasses}`}
                  />
                  <input
                    name={`roleSeats${i}`}
                    type="number"
                    min={1}
                    placeholder="المقاعد"
                    aria-label={`مقاعد الدور ${i + 1}`}
                    className={`h-11 ${controlClasses}`}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-ink">أسئلة للمتقدمين (اختياري)</p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    name={`question${i}`}
                    maxLength={300}
                    placeholder={i === 0 ? "هل شاركت في حملة مشابهة من قبل؟" : "سؤال"}
                    aria-label={`السؤال ${i + 1}`}
                    className={`h-11 ${controlClasses}`}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-muted">
                    <input type="checkbox" name={`questionRequired${i}`} className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
                    إجباري
                  </label>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : null}

      {kind === "post" && section?.slug === "humanitarian" ? (
        <Panel title="حالة إنسانية (اختياري)">
          <label className="flex items-center gap-2 text-xs font-black text-ink">
            <input
              type="checkbox"
              name="withCase"
              checked={withCase}
              onChange={(e) => setWithCase(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-primary))]"
            />
            هذا المنشور حالة إنسانية تحتاج دعماً مباشراً
          </label>
          {withCase ? (
            <>
              <Field label="رقم التواصل" hint="بالصيغة الدولية، مثل ‎+963912345678.">
                <input name="contactPhone" required dir="ltr" placeholder="+963912345678" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="صورة رمز شام كاش (اختياري)">
                <input type="file" name="paymentQr" accept="image/jpeg,image/png,image/webp" className={fileClasses} />
              </Field>
              <Field label="ملاحظة الدفع (اختياري)">
                <input name="paymentNote" maxLength={500} placeholder="التحويل باسم والد الطفلة عبر شام كاش." className={`h-12 ${controlClasses}`} />
              </Field>
              <p className="text-[11px] font-bold text-muted">لا تمر أي أموال عبر المنصة: الدعم يصل مباشرة لأصحاب الحالة.</p>
            </>
          ) : null}
        </Panel>
      ) : null}

      {kind === "post" && section?.slug === "education" ? (
        <Panel title="فرصة خارجية (اختياري)">
          <label className="flex items-center gap-2 text-xs font-black text-ink">
            <input
              type="checkbox"
              name="withOpportunity"
              checked={withOpportunity}
              onChange={(e) => setWithOpportunity(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-primary))]"
            />
            هذا المنشور فرصة يُقدَّم عليها خارج المنصة (منحة، تدريب، وظيفة، مسابقة)
          </label>
          {withOpportunity ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="رابط التقديم">
                <input name="applyUrl" type="url" required dir="ltr" placeholder="https://" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="آخر موعد (اختياري)">
                <input name="deadline" type="date" className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="طريقة الحضور">
                <select name="mode" defaultValue="ONLINE" className={`h-12 ${controlClasses}`}>
                  <option value="ONLINE">عن بُعد</option>
                  <option value="IN_PERSON">حضوري</option>
                  <option value="HYBRID">مدمج</option>
                </select>
              </Field>
              <Field label="المكان (اختياري)">
                <input name="location" maxLength={200} className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="من يحق له التقديم (اختياري)">
                <input name="eligibility" maxLength={500} className={`h-12 ${controlClasses}`} />
              </Field>
              <Field label="المجال (اختياري)">
                <input name="field" maxLength={100} placeholder="الهندسة" className={`h-12 ${controlClasses}`} />
              </Field>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <FormMessage error={state.error} />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "جارٍ النشر…" : kind === "event" ? "أنشئ الفعالية" : "انشر"}
      </Button>
    </form>
  );
}

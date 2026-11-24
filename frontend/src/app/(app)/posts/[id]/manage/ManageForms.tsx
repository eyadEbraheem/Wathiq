"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { choose } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/FormMessage";
import { controlClasses } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import {
  decideApplicationAction,
  decideBadgeAction,
  documentEventAction,
  eventStatusAction,
  moveRoleAction,
} from "@/lib/actions/organizer";
import type { EventRoleView } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

const smallSelect =
  "h-9 rounded-2xl border border-line bg-canvas px-3 text-xs font-bold text-ink outline-none focus:border-primary";

/** Accept (choosing the role when the event has roles) or reject one pending applicant. */
export function DecideForm({
  eventId,
  applicationId,
  roles,
  preferredRoleId,
}: {
  eventId: number;
  applicationId: number;
  roles: EventRoleView[];
  preferredRoleId?: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideApplicationAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  const free = roles.filter((r) => r.seatsLeft > 0);
  const defaultRole = free.some((r) => r.id === preferredRoleId) ? preferredRoleId : free[0]?.id;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex flex-wrap items-center gap-2">
        {roles.length > 0 ? (
          <select name="roleId" defaultValue={defaultRole ?? ""} className={smallSelect} aria-label="الدور">
            {free.length === 0 ? <option value="">كل الأدوار ممتلئة</option> : null}
            {free.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · باقي {r.seatsLeft}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          onClick={choose("accept")}
          disabled={pending}
          className="organic organic-sm bg-teal-grad px-4 py-2 text-xs font-black text-white shadow-glow disabled:opacity-60"
        >
          قبول
        </button>
        <button
          type="submit"
          onClick={choose("reject")}
          disabled={pending}
          className="organic organic-sm border border-line bg-canvas px-4 py-2 text-xs font-extrabold text-muted hover:text-humanitarian-ink disabled:opacity-60"
        >
          رفض
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

/** Moves an accepted volunteer to another role with a free seat. */
export function MoveForm({
  eventId,
  applicationId,
  roles,
  currentRoleId,
}: {
  eventId: number;
  applicationId: number;
  roles: EventRoleView[];
  currentRoleId?: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(moveRoleAction, {});
  const targets = roles.filter((r) => r.id !== currentRoleId && r.seatsLeft > 0);
  if (targets.length === 0) return null;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="roleId" className={smallSelect} aria-label="نقل إلى دور">
          {targets.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · باقي {r.seatsLeft}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="organic organic-sm bg-icy px-4 py-2 text-xs font-black text-primary-ink disabled:opacity-60"
        >
          نقل للدور
        </button>
      </div>
      <FormMessage error={state.error} notice={state.notice} />
    </form>
  );
}

/** Close registration or cancel the event, behind a confirmation checkbox. */
export function StatusForm({ eventId, action: kind }: { eventId: number; action: "close" | "cancel" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(eventStatusAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2 rounded-2xl border border-line bg-canvas p-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="action" value={kind} />
      <p className="text-xs font-black text-ink">
        {kind === "close" ? "إغلاق التسجيل يدوياً" : "إلغاء الفعالية"}
      </p>
      <p className="text-[11px] font-semibold leading-6 text-muted">
        {kind === "close"
          ? "لن يستطيع أحد التقديم بعد الآن، ولن يُفتح التسجيل تلقائياً. يمكنك متابعة الطلبات المعلّقة."
          : "يُبلَّغ كل المتقدمين والمقبولين. لا يمكن التراجع عن الإلغاء."}
      </p>
      <label className="flex items-center gap-2 text-[11px] font-bold text-ink">
        <input type="checkbox" name="confirm" className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
        أنا متأكد
      </label>
      <FormMessage error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className={`organic organic-sm px-4 py-2 text-xs font-black disabled:opacity-60 ${
          kind === "cancel"
            ? "border border-humanitarian/40 bg-humanitarian/10 text-humanitarian-ink"
            : "bg-navy-grad text-white"
        }`}
      >
        {kind === "close" ? "أغلق التسجيل" : "ألغِ الفعالية"}
      </button>
    </form>
  );
}

/** Documentation: what happened, photos, and up to six impact numbers. */
export function DocumentForm({ eventId, labelSuggestions }: { eventId: number; labelSuggestions: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(documentEventAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-ink">ماذا حدث في الفعالية؟</span>
        <textarea
          name="documentation"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          placeholder="زرعنا 300 شجرة مع 25 متطوعاً من أهالي الحي…"
          className={`py-3 leading-7 ${controlClasses}`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-black text-ink">صور من الفعالية (1 إلى 20، JPG أو PNG أو WebP)</span>
        <input
          type="file"
          name="images"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          className="block w-full text-xs font-bold text-muted file:me-3 file:rounded-xl file:border-0 file:bg-icy file:px-4 file:py-2 file:text-xs file:font-black file:text-primary-ink"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-black text-ink">أرقام الأثر (اختياري)</legend>
        <datalist id="impact-labels">
          {labelSuggestions.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_120px] gap-2">
            <input
              name={`metricLabel${i}`}
              list="impact-labels"
              maxLength={60}
              placeholder={i === 0 ? "أشجار مزروعة" : "اسم الرقم"}
              aria-label={`اسم الرقم ${i + 1}`}
              className={`h-11 ${controlClasses}`}
            />
            <input
              name={`metricValue${i}`}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="300"
              aria-label={`قيمة الرقم ${i + 1}`}
              className={`h-11 ${controlClasses}`}
            />
          </div>
        ))}
      </fieldset>
      <FormMessage error={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الرفع والتوثيق…" : "وثّق الفعالية"}
      </Button>
    </form>
  );
}

/** Approve (with an optional thank-you line) or reject one badge request. */
export function BadgeDecision({ eventId, badgeId }: { eventId: number; badgeId: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideBadgeAction, {});
  if (state.notice) return <FormMessage notice={state.notice} />;
  return (
    <form action={action} onSubmit={keepValuesOnSubmit(action)} className="space-y-2">
      <input type="hidden" name="decision" defaultValue="" />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="badgeId" value={badgeId} />
      <input
        name="description"
        maxLength={300}
        placeholder="كلمة شكر تظهر على الشارة (اختياري)"
        aria-label="كلمة شكر"
        className={`h-10 ${controlClasses}`}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          onClick={choose("approve")}
          disabled={pending}
          className="organic organic-sm bg-teal-grad px-4 py-2 text-xs font-black text-white shadow-glow disabled:opacity-60"
        >
          منح الشارة
        </button>
        <button
          type="submit"
          onClick={choose("reject")}
          disabled={pending}
          className="organic organic-sm border border-line bg-canvas px-4 py-2 text-xs font-extrabold text-muted disabled:opacity-60"
        >
          رفض
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}

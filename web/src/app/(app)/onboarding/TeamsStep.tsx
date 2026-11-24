"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import type { FormState } from "@/lib/actions/auth";
import { requestMembershipAction, searchTeamsAction } from "@/lib/actions/users";
import { keepValuesOnSubmit } from "@/lib/forms";
import type { MyMembership, UserCard } from "@/lib/types";

const initialState: FormState = {};

const STATUS_LABEL: Record<MyMembership["status"], string> = {
  PENDING: "بانتظار موافقة الجمعية",
  APPROVED: "مقبول",
  REJECTED: "مرفوض",
  REMOVED: "أُزيل",
};

/**
 * Wizard step 3: the user types part of a name, picks a verified account from the
 * suggestions and sends a membership request. Requests already sent are listed below.
 */
export function TeamsStep({ memberships }: { memberships: MyMembership[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserCard[]>([]);
  const [searched, setSearched] = useState("");
  const [searching, startSearch] = useTransition();
  const [picked, setPicked] = useState<UserCard | null>(null);
  const [sent, setSent] = useState<string | undefined>();

  // Suggestions follow what is typed, after a short pause.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchTeamsAction(text));
        setSearched(text);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const typed = query.trim().length >= 2;
  const sentIds = new Set(
    memberships.filter((m) => m.status === "PENDING" || m.status === "APPROVED").map((m) => m.team.id),
  );

  return (
    <div className="space-y-6">
      {picked ? (
        <RequestForm
          team={picked}
          key={picked.id}
          onDone={(notice) => {
            setPicked(null);
            setSent(notice);
          }}
        />
      ) : (
        <div className="space-y-3">
          <FormMessage notice={sent} />
          <Input
            id="teamSearch"
            label="اسم الجمعية أو الفريق"
            placeholder="اكتب حرفين على الأقل…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSent(undefined);
            }}
            autoComplete="off"
            maxLength={100}
          />
          {typed ? (
            <div aria-live="polite">
              {searching && searched !== query.trim() ? (
                <p className="text-xs font-semibold text-muted">جارٍ البحث…</p>
              ) : results.length === 0 ? (
                <p className="text-xs font-semibold leading-6 text-muted">
                  لا توجد جمعية موثّقة بهذا الاسم على واثق بعد. يمكن إضافة الجمعيات الموثّقة فقط.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-canvas">
                  {results.map((team) => (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(team)}
                        disabled={sentIds.has(team.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-icy disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Avatar name={team.name} src={team.avatarUrl} verified={Boolean(team.verifiedKind)} size="sm" />
                        <span className="flex-1 text-sm font-black text-ink">{team.name}</span>
                        <span className="text-[11px] font-extrabold text-primary-ink">
                          {sentIds.has(team.id) ? "أرسلت طلباً" : "اختيار"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}

      {memberships.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-display text-base font-black text-ink">طلباتك</h2>
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                <Avatar name={m.team.name} src={m.team.avatarUrl} verified size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-ink">{m.team.name}</div>
                  {m.role ? <div className="text-[11px] font-semibold text-muted">{m.role}</div> : null}
                </div>
                <span className="rounded-full bg-icy px-3 py-1 text-[10px] font-black text-primary-ink">
                  {STATUS_LABEL[m.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <ButtonLink href="/">{memberships.length > 0 ? "إنهاء ←" : "لست عضواً في جمعية، إنهاء ←"}</ButtonLink>
        <ButtonLink href="/onboarding?step=profile" variant="ghost">
          رجوع
        </ButtonLink>
      </div>
    </div>
  );
}

function RequestForm({ team, onDone }: { team: UserCard; onDone: (notice?: string) => void }) {
  const [state, formAction, pending] = useActionState(requestMembershipAction, initialState);
  const thisYear = new Date().getFullYear();

  // After a successful request, go back to the search; the list below shows the new request.
  useEffect(() => {
    if (state.notice) onDone(state.notice);
  }, [state.notice, onDone]);

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-icy px-4 py-3">
        <Avatar name={team.name} src={team.avatarUrl} verified size="md" />
        <span className="flex-1 font-display text-base font-black text-ink">{team.name}</span>
        <button type="button" onClick={() => onDone()} className="text-xs font-extrabold text-primary-ink hover:underline">
          تغيير
        </button>
      </div>
      <FormMessage error={state.error} />
      <input type="hidden" name="teamId" value={team.id} />
      <Input id="role" name="role" label="دورك في الجمعية (اختياري)" placeholder="مثلاً: منسّق ميداني" maxLength={80} />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="startYear"
          name="startYear"
          type="number"
          label="سنة البداية (اختياري)"
          min={1950}
          max={thisYear}
          dir="ltr"
        />
        <Input
          id="endYear"
          name="endYear"
          type="number"
          label="سنة الانتهاء"
          hint="اتركها فارغة إذا كنت ما زلت عضواً."
          min={1950}
          max={thisYear}
          dir="ltr"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "أرسل طلب الانضمام"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Icon } from "@/components/ui/Icon";
import type { FormState } from "@/lib/actions/auth";
import { saveInterestsAction } from "@/lib/actions/users";
import { sectionLook } from "@/lib/sections";
import type { Interests, Section } from "@/lib/types";
import { keepValuesOnSubmit } from "@/lib/forms";

const initialState: FormState = {};

export function InterestsForm({
  sections,
  initial,
  next,
}: {
  sections: Section[];
  initial: Interests;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(saveInterestsAction, initialState);
  const [chosen, setChosen] = useState<number[]>(initial.sectionIds);
  const [topics, setTopics] = useState<number[]>(initial.topicIds);
  const [primary, setPrimary] = useState<number | null>(initial.primarySectionId);

  function toggleSection(section: Section) {
    if (chosen.includes(section.id)) {
      setChosen(chosen.filter((id) => id !== section.id));
      // Topics of a section you no longer follow are dropped too.
      const ids = section.topics.map((t) => t.id);
      setTopics(topics.filter((id) => !ids.includes(id)));
      if (primary === section.id) setPrimary(null);
    } else {
      setChosen([...chosen, section.id]);
      if (primary === null) setPrimary(section.id);
    }
  }

  function toggleTopic(id: number) {
    setTopics(topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id]);
  }

  return (
    <form action={formAction} onSubmit={keepValuesOnSubmit(formAction)} className="space-y-7">
      <FormMessage error={state.error} />
      <input type="hidden" name="next" value={next} />

      <fieldset>
        <legend className="mb-3 font-display text-base font-black text-ink">١. الأقسام التي تهمّك</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const on = chosen.includes(section.id);
            const look = sectionLook(section.slug);
            return (
              <label
                key={section.id}
                className={`organic flex cursor-pointer items-center justify-between gap-3 border-2 p-4 ${
                  on ? `flipped shadow-soft ${look.chosen}` : look.soft
                }`}
              >
                <input
                  type="checkbox"
                  name="sectionIds"
                  value={section.id}
                  checked={on}
                  onChange={() => toggleSection(section)}
                  className="sr-only"
                />
                <span className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${look.solid}`}>
                    <Icon name={look.icon} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-ink">{section.nameAr}</span>
                    <span className={`block text-[11px] font-bold ${look.text}`}>{section.topics.length} مواضيع</span>
                  </span>
                </span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                    on ? `${look.solid}` : "bg-line text-muted"
                  }`}
                >
                  {on ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : "+"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {chosen.length > 0 ? (
        <fieldset>
          <legend className="mb-3 font-display text-base font-black text-ink">٢. المواضيع</legend>
          <div className="space-y-4">
            {sections
              .filter((s) => chosen.includes(s.id))
              .map((section) => (
                <div key={section.id}>
                  <p className={`mb-2 text-xs font-black ${sectionLook(section.slug).text}`}>{section.nameAr}</p>
                  <div className="flex flex-wrap gap-2">
                    {section.topics.map((topic) => {
                      const on = topics.includes(topic.id);
                      return (
                        <label
                          key={topic.id}
                          className={`organic organic-sm cursor-pointer px-4 py-1.5 text-xs ${
                            on
                              ? "flipped bg-teal-grad font-black text-white shadow-glow"
                              : "bg-icy/70 font-extrabold text-ink hover:bg-icy"
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="topicIds"
                            value={topic.id}
                            checked={on}
                            onChange={() => toggleTopic(topic.id)}
                            className="sr-only"
                          />
                          {topic.nameAr}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </fieldset>
      ) : null}

      {chosen.length > 1 ? (
        <fieldset>
          <legend className="mb-1 font-display text-base font-black text-ink">٣. قسمك الرئيسي</legend>
          <p className="mb-3 text-xs font-semibold text-muted">يظهر أولاً في صفحتك الرئيسية، ويمكنك تغييره لاحقاً.</p>
          <div className="flex flex-wrap gap-2">
            {sections
              .filter((s) => chosen.includes(s.id))
              .map((section) => (
                <label
                  key={section.id}
                  className={`organic organic-sm cursor-pointer px-4 py-2 text-xs ${
                    primary === section.id
                      ? "flipped bg-navy-grad font-black text-white"
                      : "border border-line bg-surface font-extrabold text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="primarySectionId"
                    value={section.id}
                    checked={primary === section.id}
                    onChange={() => setPrimary(section.id)}
                    className="sr-only"
                  />
                  {section.nameAr}
                </label>
              ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="primarySectionId" value={chosen[0] ?? ""} />
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "جارٍ الحفظ…" : "حفظ ومتابعة ←"}
      </Button>
    </form>
  );
}

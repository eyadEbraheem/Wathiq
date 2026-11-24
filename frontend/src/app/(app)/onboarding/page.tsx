import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { isOrganization } from "@/lib/accounts";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import type { Interests, MyMembership, Paginated, Section } from "@/lib/types";
import { InterestsForm } from "./InterestsForm";
import { ProfileStep } from "./ProfileStep";
import { TeamsStep } from "./TeamsStep";

export const metadata = { title: "إكمال حسابك · واثق" };

type Step = "interests" | "profile" | "teams";

const STEPS: { key: Step; label: string }[] = [
  { key: "interests", label: "اهتماماتك" },
  { key: "profile", label: "معلوماتك" },
  { key: "teams", label: "جمعياتك" },
];

const INTRO: Record<Step, { title: string; text: string }> = {
  interests: {
    title: "ما الذي يهمّك؟",
    text: "اختر الأقسام والمواضيع التي تحب أن تتابعها، وسنعرض لك ما يناسبك ونرسل لك إشعارات بالجديد.",
  },
  profile: {
    title: "عرّفنا بنفسك",
    text: "عنوانك ودراستك وعملك تساعد الجمعيات على إيجادك لفرص التطوع المناسبة. كلها اختيارية، ومخفية عن الناس حتى تختار إظهارها من إعدادات الخصوصية.",
  },
  teams: {
    title: "هل أنت عضو في جمعية أو فريق؟",
    text: "ابحث عن جمعيتك بالاسم وأرسل طلب انضمام. تظهر في ملفك بعد أن توافق الجمعية.",
  },
};

/**
 * The sign-up wizard: interests (required), then profile details and team memberships
 * (both skippable). `?next=/me` edits the interests only and goes back to /me.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; step?: string }>;
}) {
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  if (!user) redirect("/login");
  const { next, step: rawStep } = await searchParams;
  // Organizations do not join teams: their wizard ends after the address.
  const organization = isOrganization(user);
  if (organization && rawStep === "teams") redirect("/");
  const steps = organization ? STEPS.filter((s) => s.key !== "teams") : STEPS;
  const editing = next === "/me";
  const step: Step = !editing && (rawStep === "profile" || rawStep === "teams") ? rawStep : "interests";

  let body: React.ReactNode;
  if (step === "interests") {
    const [sectionsRes, interestsRes] = await Promise.all([
      apiFetch("/sections?limit=100", { token }),
      apiFetch("/users/me/interests", { token }),
    ]);
    if (!sectionsRes.ok || !interestsRes.ok) {
      throw new Error("Could not load sections or interests.");
    }
    const sections = ((await sectionsRes.json()) as Paginated<Section>).data;
    const interests = (await interestsRes.json()) as Interests;
    body = <InterestsForm sections={sections} initial={interests} next={editing ? "/me" : "/"} />;
  } else {
    // The optional steps come after the interests.
    if (!user.onboardingCompletedAt) redirect("/onboarding");
    if (step === "profile") {
      body = <ProfileStep user={user} />;
    } else {
      const res = await apiFetch("/team-memberships/me?limit=50", { token });
      if (!res.ok) throw new Error("Could not load memberships.");
      const memberships = ((await res.json()) as Paginated<MyMembership>).data;
      body = <TeamsStep memberships={memberships} />;
    }
  }

  const current = steps.findIndex((s) => s.key === step);
  const intro =
    organization && step === "interests"
      ? {
          title: "في أي أقسام تعمل جمعيتكم؟",
          text: "اختر الأقسام والمواضيع التي تعمل فيها الجمعية. بها تظهر في دليل الجمعيات، وتصلك إشعارات بالجديد فيها.",
        }
      : organization && step === "profile"
        ? { title: "أين تعمل الجمعية؟", text: "عنوان الجمعية يساعد المتطوعين على إيجادكم. المحافظة والمدينة تظهران دائماً." }
        : INTRO[step];

  return (
    <div className="view-pop mx-auto max-w-4xl space-y-5">
      <Card className="space-y-3 p-6 sm:p-8">
        {editing ? (
          <span className="rounded-full bg-icy px-3 py-1 text-[11px] font-black text-primary-ink">تعديل الاهتمامات</span>
        ) : (
          <ol className="flex flex-wrap items-center gap-2" aria-label="خطوات إكمال الحساب">
            {steps.map((s, i) => (
              <li
                key={s.key}
                aria-current={i === current ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
                  i === current
                    ? "bg-teal-grad text-white"
                    : i < current
                      ? "bg-icy text-primary-ink"
                      : "border border-line text-muted"
                }`}
              >
                <span>{i + 1}</span>
                {s.label}
                {i > 0 ? <span className="font-bold opacity-80">(اختياري)</span> : null}
              </li>
            ))}
          </ol>
        )}
        <h1 className="font-display text-2xl font-black text-ink">{intro.title}</h1>
        <p className="text-sm font-semibold leading-7 text-muted">{intro.text}</p>
      </Card>
      <Card className="p-6 sm:p-8">{body}</Card>
    </div>
  );
}

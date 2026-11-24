import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import { VerifyForm } from "./VerifyForm";

export const metadata = { title: "توثيق الحساب · واثق" };

interface MyRequest {
  id: number;
  kind: "ORGANIZATION" | "INDIVIDUAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string;
  createdAt: string;
  reviewedAt: string | null;
}

const STATUS: Record<MyRequest["status"], { text: string; tone: string }> = {
  PENDING: { text: "قيد المراجعة", tone: "bg-community/15 text-community-ink" },
  APPROVED: { text: "مقبول", tone: "bg-environment/10 text-environment-ink" },
  REJECTED: { text: "مرفوض", tone: "bg-humanitarian/10 text-humanitarian-ink" },
};

/** Ask the platform to verify the account (needed to publish and organize events). */
export default async function VerifyPage() {
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  if (!user) redirect("/login");

  const res = await apiFetch("/verification-requests/me", { token });
  const body = res.ok ? ((await res.json()) as MyRequest[] | { data: MyRequest[] }) : [];
  const requests = Array.isArray(body) ? body : body.data;
  const pending = requests.some((r) => r.status === "PENDING");
  // Signed up as an organization: frozen until this request is approved.
  const newOrganization = user.pendingOrganization;

  return (
    <div className="view-pop mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">
          {newOrganization ? "توثيق الجمعية" : "توثيق الحساب"}
        </h1>
        <p className="text-xs font-semibold leading-6 text-muted">
          {newOrganization
            ? "حساب الجمعية للتصفح فقط حتى يوافق فريق واثق على التوثيق. أرسلوا أوراق الجمعية، وبعد الموافقة تستطيعون النشر وتنظيم الفعاليات."
            : "الحسابات الموثّقة تنشر المنشورات والحالات وتنظّم الفعاليات. يراجع فريق واثق كل طلب بنفسه."}
        </p>
      </div>

      {user.verifiedKind ? (
        <Card className="flex items-center gap-3 p-6">
          <Icon name="shield" className="h-8 w-8 text-environment" />
          <p className="text-sm font-black text-ink">حسابك موثّق. يمكنك النشر وتنظيم الفعاليات.</p>
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <Card className="divide-y divide-line/70 overflow-hidden">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <div className="text-sm font-black text-ink">
                  طلب {r.kind === "ORGANIZATION" ? "منظمة" : "شخص"} · {formatDay(r.createdAt)}
                </div>
                {r.status === "REJECTED" && r.rejectionReason ? (
                  <div className="text-xs font-semibold text-muted">السبب: {r.rejectionReason}</div>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${STATUS[r.status].tone}`}>
                {STATUS[r.status].text}
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      {!user.verifiedKind && !pending ? (
        <Card className="p-6 sm:p-8">
          <VerifyForm
            organizationOnly={newOrganization}
            foundedAt={newOrganization ? user.birthDate.slice(0, 10) : undefined}
          />
        </Card>
      ) : null}

      {newOrganization && pending && !user.onboardingCompletedAt ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm font-bold text-ink">بانتظار المراجعة، اختاروا الأقسام التي تعمل فيها الجمعية.</p>
          <ButtonLink href="/onboarding" size="sm">
            أقسام عملنا
          </ButtonLink>
        </Card>
      ) : null}
    </div>
  );
}

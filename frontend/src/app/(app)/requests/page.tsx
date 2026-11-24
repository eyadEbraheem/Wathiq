import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { cancelPublishRequestAction } from "@/lib/actions/requests";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import type { Paginated, PublicProfileView, Section, UserCard } from "@/lib/types";
import { IncomingDecision, RequestForm } from "./RequestForms";

export const metadata = { title: "طلبات النشر · واثق" };

type SearchParams = Promise<{ to?: string }>;

interface PublishRequestView {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title: string;
  body: string;
  createdAt: string;
  toPlatform: boolean;
  images: string[];
  caseDetails: { contactPhone: string } | null;
  rejectionReason: string;
  resultingPostId: number | null;
  requester: UserCard;
  targetUser: UserCard | null;
  section: { nameAr: string };
}

const STATUS: Record<PublishRequestView["status"], { text: string; tone: string }> = {
  PENDING: { text: "قيد المراجعة", tone: "bg-community/15 text-community-ink" },
  APPROVED: { text: "نُشر", tone: "bg-environment/10 text-environment-ink" },
  REJECTED: { text: "مرفوض", tone: "bg-humanitarian/10 text-humanitarian-ink" },
  CANCELLED: { text: "ألغيته", tone: "bg-canvas text-muted" },
};

/**
 * Regular users ask a verified account (?to=id) or the platform to publish for them, and follow
 * their requests. Verified accounts see the requests sent to them and decide.
 */
export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (!me) redirect("/login");
  const toId = Number((await searchParams).to) > 0 ? Number((await searchParams).to) : undefined;

  if (me.verifiedKind) {
    const res = await apiFetch("/publish-requests/incoming?status=PENDING&limit=50", { token });
    const incoming = res.ok ? ((await res.json()) as Paginated<PublishRequestView>).data : [];
    return (
      <div className="view-pop mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-display text-xl font-black text-ink">طلبات النشر الواردة</h1>
          <p className="text-xs font-semibold text-muted">
            أشخاص يطلبون منك نشر مبادرة أو حالة. يمكنك إيقاف استقبال الطلبات من إعدادات الخصوصية.
          </p>
        </div>
        {incoming.length === 0 ? (
          <Card className="p-8 text-center text-sm font-bold text-muted">لا توجد طلبات بانتظارك.</Card>
        ) : (
          incoming.map((q) => (
            <Card key={q.id} className="space-y-3 p-5">
              <div className="text-[11px] font-bold text-muted">
                {q.section.nameAr} · من{" "}
                <Link href={`/users/${q.requester.id}`} className="text-primary-ink underline">
                  {q.requester.name}
                </Link>{" "}
                · {timeAgo(q.createdAt)}
              </div>
              <h2 className="font-display text-base font-black text-ink">{q.title}</h2>
              <p className="whitespace-pre-line text-sm font-medium leading-7 text-ink-soft">{q.body}</p>
              {q.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {q.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-20 w-full rounded-xl object-cover" />
                  ))}
                </div>
              ) : null}
              {q.caseDetails ? (
                <p className="rounded-xl bg-canvas p-2.5 text-xs font-bold text-muted">
                  حالة إنسانية · <span dir="ltr">{q.caseDetails.contactPhone}</span>
                </p>
              ) : null}
              <IncomingDecision id={q.id} />
            </Card>
          ))
        )}
      </div>
    );
  }

  const [sectionsRes, mineRes, targetRes] = await Promise.all([
    apiFetch("/sections?limit=100"),
    apiFetch("/publish-requests/mine?limit=50", { token }),
    toId ? apiFetch(`/users/${toId}`, { token }) : null,
  ]);
  const sections = sectionsRes.ok ? ((await sectionsRes.json()) as Paginated<Section>).data : [];
  const mine = mineRes.ok ? ((await mineRes.json()) as Paginated<PublishRequestView>).data : [];
  const target = targetRes?.ok ? ((await targetRes.json()) as PublicProfileView) : null;
  const to = target?.verifiedKind ? target : null;

  return (
    <div className="view-pop mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">طلب نشر</h1>
        <p className="text-xs font-semibold text-muted">
          {to
            ? `تطلب من ${to.name} نشر مبادرتك أو حالتك على حسابه.`
            : "تطلب من فريق واثق نشر مبادرتك أو حالتك. للطلب من منظمة معيّنة، افتح ملفها واضغط «اطلب منه النشر»."}
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <RequestForm sections={sections} targetUserId={to?.id} />
      </Card>

      {mine.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-black text-ink">طلباتي</h2>
          <Card className="divide-y divide-line/70 overflow-hidden">
            {mine.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-ink">{q.title}</div>
                  <div className="text-[11px] font-semibold text-muted">
                    إلى {q.toPlatform ? "واثق" : q.targetUser?.name} · {timeAgo(q.createdAt)}
                    {q.status === "REJECTED" && q.rejectionReason ? ` · السبب: ${q.rejectionReason}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {q.resultingPostId ? (
                    <Link href={`/posts/${q.resultingPostId}`} className="text-[11px] font-black text-primary-ink underline">
                      عرض المنشور
                    </Link>
                  ) : null}
                  {q.status === "PENDING" ? (
                    <form action={cancelPublishRequestAction}>
                      <input type="hidden" name="id" value={q.id} />
                      <button type="submit" className="text-[11px] font-bold text-muted hover:text-humanitarian-ink">
                        إلغاء
                      </button>
                    </form>
                  ) : null}
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black ${STATUS[q.status].tone}`}>
                    {STATUS[q.status].text}
                  </span>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

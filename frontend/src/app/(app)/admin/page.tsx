import Link from "next/link";
import { notFound } from "next/navigation";
import { ORGANIZATION_PAPERS } from "@csh/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { removeBannedWordAction } from "@/lib/actions/admin";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { formatDay, timeAgo } from "@/lib/format";
import { requireSessionToken } from "@/lib/session";
import type { Paginated, UserCard } from "@/lib/types";
import {
  BannedWordForm,
  PlatformDecision,
  ReportDecision,
  SuspendForm,
  VerificationDecision,
} from "./AdminForms";

export const metadata = { title: "لوحة الإدارة · واثق" };

type SearchParams = Promise<{ tab?: string; open?: string }>;

const TABS = [
  { key: "verification", label: "طلبات التوثيق" },
  { key: "reports", label: "البلاغات" },
  { key: "requests", label: "طلبات النشر للمنصة" },
  { key: "users", label: "إيقاف الحسابات" },
  { key: "words", label: "الكلمات الممنوعة" },
] as const;

const REASONS: Record<string, string> = {
  FRAUD: "احتيال",
  OFFENSIVE: "محتوى مسيء",
  SPAM: "رسائل مزعجة",
  MISLEADING: "معلومات خاطئة",
  OTHER: "سبب آخر",
};

interface VerificationItem {
  id: number;
  kind: "ORGANIZATION" | "INDIVIDUAL";
  contactPhone: string;
  foundedAt: string | null;
  details: string;
  links: string[];
  createdAt: string;
  user: { id: number; name: string };
}

interface VerificationDetail extends VerificationItem {
  user: { id: number; name: string; email: string | null; phone: string | null; createdAt: string };
  documents: { id: number; type: string; slot: number | null; fileName: string; url: string | null }[];
}

interface ReportItem {
  id: number;
  target: "POST" | "COMMENT" | "USER";
  reason: string;
  details: string;
  createdAt: string;
  reporter: UserCard;
  post: { id: number; title: string; status: string; author: UserCard } | null;
  comment: { id: number; body: string; status: string; postId: number; author: UserCard } | null;
  reportedUser: (UserCard & { isSuspended: boolean }) | null;
}

interface PlatformRequest {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  requestedAttribution: "REQUESTER" | "PUBLISHER" | null;
  images: string[];
  caseDetails: { contactPhone: string; paymentQrUrl: string; paymentNote: string } | null;
  requester: UserCard;
  section: { nameAr: string };
}

async function list<T>(path: string, token: string): Promise<T[]> {
  const res = await apiFetch(path, { token });
  return res.ok ? ((await res.json()) as Paginated<T>).data : [];
}

/** Admin basics: verification, reports, platform publish requests, suspensions, banned words. */
export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const token = await requireSessionToken();
  const me = await fetchCurrentUser(token);
  if (me?.role !== "ADMIN") notFound();
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab : "verification";
  const openId = Number(params.open) > 0 ? Number(params.open) : null;

  const [verifications, detail, reports, requests, words] = await Promise.all([
    tab === "verification" ? list<VerificationItem>("/verification-requests?status=PENDING&limit=50", token) : [],
    tab === "verification" && openId
      ? apiFetch(`/verification-requests/${openId}`, { token }).then((r) =>
          r.ok ? (r.json() as Promise<VerificationDetail>) : null,
        )
      : null,
    tab === "reports" ? list<ReportItem>("/admin/reports?limit=50", token) : [],
    tab === "requests" ? list<PlatformRequest>("/publish-requests/platform?status=PENDING&limit=50", token) : [],
    tab === "words"
      ? list<{ id: number; word: string; createdAt: string }>("/admin/banned-words?limit=100", token)
      : [],
  ]);

  const chip = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;
  const empty = (text: string) => <Card className="p-8 text-center text-sm font-bold text-muted">{text}</Card>;

  return (
    <div className="view-pop space-y-6">
      <div>
        <h1 className="font-display text-xl font-black text-ink">لوحة الإدارة</h1>
        <p className="text-xs font-semibold text-muted">الأقدم أولاً، حتى لا ينتظر أحد طويلاً.</p>
      </div>
      <div className="flex w-fit flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        {TABS.map((t) => (
          <Link key={t.key} href={`/admin?tab=${t.key}`} className={chip(tab === t.key)}>
            {t.label}
          </Link>
        ))}
        <Link href="/admin/stats" className={chip(false)}>
          الإحصائيات ←
        </Link>
      </div>

      {tab === "verification" ? (
        verifications.length === 0 ? (
          empty("لا توجد طلبات توثيق بانتظار المراجعة.")
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {verifications.map((v) => (
              <Card key={v.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={v.user.name} />
                    <div>
                      <Link href={`/users/${v.user.id}`} className="text-sm font-black text-ink hover:text-primary-ink">
                        {v.user.name}
                      </Link>
                      <div className="text-[11px] font-bold text-muted">
                        {v.kind === "ORGANIZATION" ? "منظمة" : "شخص"} · {timeAgo(v.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-muted" dir="ltr">
                    {v.contactPhone}
                  </span>
                </div>
                {v.foundedAt ? (
                  <p className="text-xs font-bold text-muted">تأسست: {formatDay(v.foundedAt)}</p>
                ) : null}
                {v.details ? <p className="text-sm font-medium leading-7 text-ink-soft">{v.details}</p> : null}
                {v.links.length > 0 ? (
                  <ul className="space-y-1 text-xs font-bold" dir="ltr">
                    {v.links.map((l) => (
                      <li key={l}>
                        <a href={l} target="_blank" rel="noopener noreferrer" className="text-primary-ink underline">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {detail && detail.id === v.id ? (
                  <div className="space-y-1.5 rounded-2xl bg-canvas p-3">
                    <p className="text-[11px] font-black text-ink">الوثائق (روابط تنتهي خلال 5 دقائق)</p>
                    {detail.documents.map((d) =>
                      d.url ? (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs font-bold text-primary-ink underline"
                        >
                          {d.type === "ORGANIZATION_PAPER"
                            ? ORGANIZATION_PAPERS[d.slot ?? 0]?.labelAr || `ورقة الجمعية ${(d.slot ?? 0) + 1}`
                            : d.type === "SUPPORTING"
                              ? "ملف داعم"
                              : d.type === "PASSPORT"
                                ? "جواز سفر"
                                : "بطاقة شخصية"} ·{" "}
                          {d.fileName}
                        </a>
                      ) : (
                        <span key={d.id} className="block text-xs text-muted">
                          {d.fileName} (حُذف)
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <Link
                    href={`/admin?tab=verification&open=${v.id}`}
                    className="inline-block text-xs font-black text-primary-ink underline"
                  >
                    عرض الوثائق
                  </Link>
                )}
                <VerificationDecision id={v.id} />
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "reports" ? (
        reports.length === 0 ? (
          empty("لا توجد بلاغات مفتوحة.")
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {reports.map((r) => (
              <Card key={r.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-humanitarian/10 px-3 py-1 text-[11px] font-black text-humanitarian-ink">
                    {REASONS[r.reason] ?? r.reason}
                  </span>
                  <span className="text-[11px] font-bold text-muted">
                    من {r.reporter.name} · {timeAgo(r.createdAt)}
                  </span>
                </div>
                {r.post ? (
                  <p className="text-sm font-black text-ink">
                    منشور:{" "}
                    <Link href={`/posts/${r.post.id}`} className="text-primary-ink underline">
                      {r.post.title}
                    </Link>{" "}
                    <span className="text-xs font-bold text-muted">({r.post.author.name})</span>
                  </p>
                ) : null}
                {r.comment ? (
                  <p className="rounded-xl bg-canvas p-2.5 text-xs font-semibold leading-6 text-ink-soft">
                    تعليق {r.comment.author.name}: «{r.comment.body}»
                  </p>
                ) : null}
                {r.reportedUser ? (
                  <p className="text-sm font-black text-ink">
                    حساب:{" "}
                    <Link href={`/users/${r.reportedUser.id}`} className="text-primary-ink underline">
                      {r.reportedUser.name}
                    </Link>
                    {r.reportedUser.isSuspended ? " (موقوف)" : ""}
                  </p>
                ) : null}
                {r.details ? <p className="text-xs font-semibold text-muted">{r.details}</p> : null}
                <ReportDecision id={r.id} canHide={r.target !== "USER"} />
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "requests" ? (
        requests.length === 0 ? (
          empty("لا توجد طلبات نشر للمنصة.")
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {requests.map((q) => (
              <Card key={q.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted">
                    {q.section.nameAr} · من {q.requester.name} · {timeAgo(q.createdAt)}
                  </span>
                  <span className="rounded-full bg-icy px-3 py-1 text-[10px] font-black text-primary-ink">
                    {q.requestedAttribution === "PUBLISHER" ? "باسم واثق" : "باسم صاحب الطلب"}
                  </span>
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
                    {q.caseDetails.paymentNote ? ` · ${q.caseDetails.paymentNote}` : ""}
                  </p>
                ) : null}
                <PlatformDecision id={q.id} />
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === "users" ? (
        <Card className="max-w-md space-y-3 p-6">
          <p className="text-xs font-semibold leading-6 text-muted">
            الحساب الموقوف يستطيع التصفح فقط: لا ينشر ولا يعلّق ولا يتقدّم للفعاليات. رقم الحساب يظهر في رابط
            ملفه الشخصي (/users/الرقم).
          </p>
          <SuspendForm />
        </Card>
      ) : null}

      {tab === "words" ? (
        <Card className="max-w-2xl space-y-4 p-6">
          <p className="text-xs font-semibold leading-6 text-muted">
            التعليقات التي تحتوي هذه الكلمات (ككلمة كاملة، بعد توحيد الحروف العربية) تُرفض فوراً.
          </p>
          <BannedWordForm />
          <ul className="flex flex-wrap gap-2">
            {words.map((w) => (
              <li key={w.id} className="flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 ps-3 pe-1 text-xs font-bold text-ink">
                {w.word}
                <form action={removeBannedWordAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button
                    type="submit"
                    aria-label={`حذف ${w.word}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-humanitarian/10 hover:text-humanitarian-ink"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

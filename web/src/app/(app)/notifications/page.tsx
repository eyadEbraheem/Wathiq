import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { markAllReadAction, openNotificationAction } from "@/lib/actions/notifications";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { notificationTarget, notificationText, type NotificationView } from "@/lib/notification-text";
import { requireSessionToken } from "@/lib/session";
import type { Paginated } from "@/lib/types";

export const metadata = { title: "الإشعارات · واثق" };

type SearchParams = Promise<{ unread?: string; page?: string }>;

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = await requireSessionToken();
  const unreadOnly = params.unread === "1";
  const page = Number(params.page) > 1 ? Number(params.page) : 1;
  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (unreadOnly) query.set("unreadOnly", "true");

  const [res, me] = await Promise.all([
    apiFetch(`/notifications?${query.toString()}`, { token }),
    fetchCurrentUser(token),
  ]);
  if (!res.ok) throw new Error(`Notifications failed with ${res.status}`);
  const { data, meta } = (await res.json()) as Paginated<NotificationView>;
  const hasUnread = data.some((n) => !n.readAt);
  const href = (q: { unread?: boolean; page?: number }) => {
    const search = new URLSearchParams();
    if (q.unread ?? unreadOnly) search.set("unread", "1");
    if (q.page && q.page > 1) search.set("page", String(q.page));
    const text = search.toString();
    return text ? `/notifications?${text}` : "/notifications";
  };
  const tab = (on: boolean) =>
    `organic organic-sm px-4 py-1.5 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;

  return (
    <div className="view-pop mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">الإشعارات</h1>
          <p className="text-xs font-semibold text-muted">كل ما يخصّك على واثق، الأحدث أولاً.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
            <Link href={href({ unread: false, page: 1 })} className={tab(!unreadOnly)}>
              الكل
            </Link>
            <Link href={href({ unread: true, page: 1 })} className={tab(unreadOnly)}>
              غير المقروءة
            </Link>
          </div>
          {hasUnread ? (
            <form action={markAllReadAction}>
              <button
                type="submit"
                className="organic organic-sm bg-icy px-3 py-2 text-[11px] font-black text-primary-ink"
              >
                تحديد الكل كمقروء
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {data.length === 0 ? (
        <Card className="space-y-2 p-10 text-center">
          <Icon name="bell" className="mx-auto h-8 w-8 text-primary" />
          <p className="text-sm font-black text-ink">
            {unreadOnly ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات بعد"}
          </p>
          <p className="text-xs font-semibold text-muted">
            تابع حسابات واختر اهتماماتك لتصلك أخبار ما يهمّك.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-line/70 overflow-hidden">
          {data.map((n) => {
            const { text, icon } = notificationText(n);
            const target = notificationTarget(n, me ?? undefined);
            return (
              <form key={n.id} action={openNotificationAction}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="target" value={target} />
                <button
                  type="submit"
                  className={`flex w-full items-start gap-3 p-4 text-right transition hover:bg-icy/60 ${
                    n.readAt ? "" : "bg-icy/40"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      n.readAt ? "bg-canvas text-muted" : "bg-teal-grad text-white"
                    }`}
                  >
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-7 ${n.readAt ? "font-semibold text-muted" : "font-black text-ink"}`}>
                      {text}
                    </span>
                    <span className="text-[11px] font-bold text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.readAt ? (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" />
                  ) : null}
                </button>
              </form>
            );
          })}
        </Card>
      )}

      {meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="الصفحات">
          {page > 1 ? (
            <ButtonLink href={href({ page: page - 1 })} variant="secondary" size="sm">
              الأحدث
            </ButtonLink>
          ) : null}
          <span className="text-xs font-bold text-muted">
            صفحة {page} من {meta.totalPages}
          </span>
          {page < meta.totalPages ? (
            <ButtonLink href={href({ page: page + 1 })} variant="secondary" size="sm">
              الأقدم
            </ButtonLink>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

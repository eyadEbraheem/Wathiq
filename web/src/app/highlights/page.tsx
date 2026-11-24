import Link from "next/link";
import { notFound } from "next/navigation";
import {
  newVolunteersWord,
  WeeklyHighlightCard,
  weekRange,
} from "@/components/highlights/WeeklyHighlightCard";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import type { Paginated, WeeklyHighlight } from "@/lib/types";

export const metadata = { title: "لوحة الشرف · جمعية الأسبوع · واثق" };

const PAGE_SIZE = 20;

type Winner = WeeklyHighlight & { organizer: NonNullable<WeeklyHighlight["organizer"]> };

/**
 * Honour board: every organization of the week, newest first. Public (visitors too), like the
 * card on the home page.
 */
export default async function HighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const res = await apiFetch(`/highlights?page=${page}&limit=${PAGE_SIZE}`);
  if (!res.ok) throw new Error(`Highlights failed with ${res.status}`);
  const board = (await res.json()) as Paginated<Winner>;
  if (page > 1 && board.data.length === 0) notFound();

  // Wins per account on this page, for the "× N" next to repeat winners.
  const wins = new Map<number, number>();
  for (const h of board.data) wins.set(h.organizer.id, (wins.get(h.organizer.id) ?? 0) + 1);
  const [latest, ...rest] = board.data;

  return (
    <div className="view-pop space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">لوحة الشرف: جمعية الأسبوع</h1>
        <p className="mt-1 text-xs font-semibold leading-6 text-muted">
          كل سبت نختار الجهة التي استقبلت أكبر عدد من المتطوعين الذين يتطوعون لأول مرة، في فعاليات
          اكتملت ووُثّقت خلال الأسبوع (من السبت إلى الجمعة). نحتاج 5 متطوعين جدد على الأقل لنعلن
          جمعية الأسبوع.
        </p>
      </div>

      {board.data.length === 0 ? (
        <Card className="p-8 text-center text-sm font-semibold text-muted">
          لم تُعلن جمعية الأسبوع بعد. ستظهر هنا أول جهة تستقبل 5 متطوعين جدد في أسبوع واحد.
        </Card>
      ) : null}

      {page === 1 && latest ? <WeeklyHighlightCard highlight={latest} /> : null}

      {(page === 1 ? rest : board.data).length > 0 ? (
        <Card className="divide-y divide-line p-0">
          {(page === 1 ? rest : board.data).map((h) => (
            <Link
              key={h.weekStart}
              href={`/users/${h.organizer.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-icy/60"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={h.organizer.name} src={h.organizer.avatarUrl} verified size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-ink">
                    {h.organizer.name}
                    {(wins.get(h.organizer.id) ?? 0) > 1 ? (
                      <span className="text-[11px] font-bold text-community-ink">
                        {" "}
                        · ⭐ × {wins.get(h.organizer.id)}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[11px] font-bold text-muted">{weekRange(h)}</span>
                </span>
              </span>
              <span className="shrink-0 text-center">
                <span className="block font-display text-lg font-black text-primary-ink">
                  {h.newVolunteers}
                </span>
                <span className="block text-[10px] font-bold text-muted">
                  {newVolunteersWord(h.newVolunteers)}
                </span>
              </span>
            </Link>
          ))}
        </Card>
      ) : null}

      {board.meta.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-xs font-black" aria-label="الصفحات">
          {page > 1 ? (
            <Link href={`/highlights?page=${page - 1}`} className="text-primary-ink hover:underline">
              → الأحدث
            </Link>
          ) : null}
          <span className="text-muted">
            صفحة {page} من {board.meta.totalPages}
          </span>
          {page < board.meta.totalPages ? (
            <Link href={`/highlights?page=${page + 1}`} className="text-primary-ink hover:underline">
              الأقدم ←
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

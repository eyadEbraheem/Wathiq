import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import type { Paginated, Section } from "@/lib/types";
import { NewForm } from "./NewForm";

export const metadata = { title: "نشر جديد · واثق" };

type SearchParams = Promise<{ type?: string }>;

/** Verified accounts publish a post (case, opportunity) or create an event. */
export default async function NewPage({ searchParams }: { searchParams: SearchParams }) {
  const kind = (await searchParams).type === "event" ? "event" : "post";
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  if (!user) redirect("/login");

  if (!user.verifiedKind) {
    return (
      <Card className="view-pop mx-auto mt-6 max-w-lg space-y-3 p-8 text-center">
        <Icon name="shield" className="mx-auto h-10 w-10 text-primary" />
        <h1 className="font-display text-lg font-black text-ink">النشر للحسابات الموثّقة</h1>
        <p className="text-sm font-semibold leading-7 text-muted">
          تنشر المنظمات والأشخاص الموثّقون المنشورات وينظّمون الفعاليات، حتى يثق الناس بما يرونه.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <ButtonLink href="/verify">اطلب توثيق حسابك</ButtonLink>
          <ButtonLink href="/requests" variant="secondary">
            أو اطلب من غيرك النشر
          </ButtonLink>
        </div>
      </Card>
    );
  }

  const res = await apiFetch("/sections?limit=100");
  if (!res.ok) throw new Error(`Sections failed with ${res.status}`);
  const sections = ((await res.json()) as Paginated<Section>).data;
  const tab = (on: boolean) =>
    `organic organic-sm flex items-center gap-1.5 px-4 py-2 text-xs ${
      on ? "flipped bg-teal-grad font-black text-white shadow-sm" : "font-extrabold text-muted hover:text-ink"
    }`;

  return (
    <div className="view-pop mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">
            {kind === "event" ? "فعالية جديدة" : "منشور جديد"}
          </h1>
          <p className="text-xs font-semibold text-muted">
            {kind === "event"
              ? "ادعُ المتطوعين، وحدّد الأدوار والمقاعد إن أردت."
              : "شارك مبادرة أو حالة إنسانية أو فرصة تعليمية."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
          <Link href="/new" className={tab(kind === "post")}>
            <Icon name="comment" className="h-4 w-4" />
            منشور
          </Link>
          <Link href="/new?type=event" className={tab(kind === "event")}>
            <Icon name="calendar" className="h-4 w-4" />
            فعالية
          </Link>
        </div>
      </div>
      <Card className="p-6 sm:p-8">
        <NewForm key={kind} kind={kind} sections={sections} />
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { isFrozen } from "@/lib/accounts";
import { fetchCurrentUser } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/** Pages for signed-in users only. A new organization sees it can only browse for now. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = await requireSessionToken();
  const user = await fetchCurrentUser(token);
  if (!user) redirect("/login");
  return (
    <>
      {isFrozen(user) ? (
        <div
          role="status"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-community/30 bg-community/10 px-4 py-3"
        >
          <p className="text-xs font-extrabold leading-6 text-community-ink">
            حساب الجمعية بانتظار التوثيق: يمكنكم التصفح وتعديل حسابكم فقط، حتى يوافق فريق واثق.
          </p>
          <Link href="/verify" className="text-xs font-black text-primary-ink hover:underline">
            حالة التوثيق ←
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}

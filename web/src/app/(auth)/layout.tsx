import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";

/** Login / register: the reference welcome screen. Already signed-in users go home. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSessionToken()) redirect("/");
  return <div className="view-pop mx-auto max-w-5xl py-2">{children}</div>;
}

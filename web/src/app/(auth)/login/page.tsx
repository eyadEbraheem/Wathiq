import { AuthFrame } from "@/components/auth/AuthFrame";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "تسجيل الدخول · واثق" };

type SearchParams = Promise<{ reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { reset } = await searchParams;
  return (
    <AuthFrame mode="login">
      <div>
        <h2 className="font-display text-xl font-black text-ink">تسجيل الدخول إلى حسابك</h2>
        <p className="mt-0.5 text-xs font-semibold text-muted">أدخل بريدك الإلكتروني وكلمة المرور.</p>
      </div>
      <LoginForm notice={reset === "1" ? "تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة." : undefined} />
    </AuthFrame>
  );
}

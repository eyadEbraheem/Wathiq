import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "إعادة تعيين كلمة المرور · واثق" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame mode="login">
      <ResetPasswordForm />
    </AuthFrame>
  );
}

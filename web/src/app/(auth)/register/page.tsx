import { AuthFrame } from "@/components/auth/AuthFrame";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "إنشاء حساب · واثق" };

export default function RegisterPage() {
  return (
    <AuthFrame mode="register">
      <RegisterForm />
    </AuthFrame>
  );
}

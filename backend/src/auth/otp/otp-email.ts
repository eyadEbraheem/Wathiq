import type { OtpMessage, OtpReason } from 'src/auth/otp/otp-sender';

export interface OtpEmail {
  subject: string;
  html: string;
  text: string;
}

const COPY: Record<
  'ar' | 'en',
  {
    brand: string;
    reasons: Record<OtpReason, string>;
    body: (min: number) => string;
    ignore: string;
  }
> = {
  ar: {
    brand: 'واثق',
    reasons: {
      SIGNUP: 'رمز تأكيد حسابك في واثق',
      CONTACT_VERIFY: 'رمز تأكيد بريدك في واثق',
      PASSWORD_RESET: 'رمز إعادة تعيين كلمة المرور في واثق',
    },
    body: (min) => `استخدم هذا الرمز خلال ${min} دقائق. لا تشاركه مع أي أحد.`,
    ignore: 'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.',
  },
  en: {
    brand: 'Wathiq',
    reasons: {
      SIGNUP: 'Your Wathiq sign-up code',
      CONTACT_VERIFY: 'Your Wathiq email confirmation code',
      PASSWORD_RESET: 'Your Wathiq password reset code',
    },
    body: (min) =>
      `Use this code within ${min} minutes. Never share it with anyone.`,
    ignore: "If you didn't ask for this code, you can ignore this email.",
  },
};

/** Subject, HTML and plain text for a one-time code email, in the user's language. */
export function buildOtpEmail(message: OtpMessage): OtpEmail {
  const lang = message.locale === 'en' ? 'en' : 'ar';
  const copy = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const subject = copy.reasons[message.reason];
  const body = copy.body(message.expiresInMinutes);

  // Inline styles only: email clients ignore <style> blocks and external CSS.
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
<body style="margin:0;padding:24px;background:#F8F3E8;font-family:Tahoma,Arial,sans-serif;color:#2E2B24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FDFBF6;border-radius:16px;border:1px solid #F0E7D5;">
    <tr><td style="padding:28px 28px 8px;text-align:center;">
      <div style="font-size:22px;font-weight:bold;color:#3C5631;">${copy.brand}</div>
      <div style="margin-top:16px;font-size:16px;font-weight:bold;">${subject}</div>
    </td></tr>
    <tr><td style="padding:16px 28px;text-align:center;">
      <div dir="ltr" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#F0F5EC;color:#304529;font-size:30px;font-weight:bold;letter-spacing:8px;">${message.code}</div>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;text-align:center;font-size:14px;line-height:1.7;color:#5F584B;">
      ${body}<br />${copy.ignore}
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${subject}\n\n${message.code}\n\n${body}\n${copy.ignore}`;
  return { subject, html, text };
}

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { createTransport } from 'nodemailer';
import { buildOtpEmail } from 'src/auth/otp/otp-email';
import { OtpMessage, OtpSender } from 'src/auth/otp/otp-sender';

const TIMEOUT_MS = 10_000;
const GMAIL_SMTP = 'smtp.gmail.com';

/**
 * Sends codes by email from a Gmail account over SMTP, with a Google "app password"
 * (docs/OUTSIDE-BOOTCAMP.md). No review or activation step, about 500 emails a day.
 * Email only: SMS codes are refused here.
 */
@Injectable()
export class GmailOtpSender extends OtpSender {
  private readonly logger = new Logger(GmailOtpSender.name);
  private readonly user: string;
  private readonly pass: string;
  private readonly from: string;

  constructor(config: ConfigService) {
    super();
    const user = config.getOrThrow<string>('GMAIL_USER');
    this.user = user;
    // Google shows the app password in groups of four ("abcd efgh ..."); spaces are not part of it.
    this.pass = config
      .getOrThrow<string>('GMAIL_APP_PASSWORD')
      .replace(/\s+/g, '');
    const name = config.get<string>('EMAIL_FROM_NAME') ?? 'واثق';
    // Gmail always sends from the account itself, so the sender address is GMAIL_USER.
    this.from = `"${name}" <${user}>`;
  }

  async send(message: OtpMessage): Promise<void> {
    if (message.channel !== 'EMAIL') {
      throw new ServiceUnavailableException(
        'Sending codes by SMS is not available yet.',
      );
    }
    const email = buildOtpEmail(message);
    try {
      // Look Gmail up through the operating system, then connect to that address. nodemailer's
      // own lookup asks DNS servers directly, which fails behind some VPNs / local DNS proxies.
      const { address } = await lookup(GMAIL_SMTP, { family: 4 });
      const transporter = createTransport({
        host: address,
        port: 465,
        secure: true,
        // The certificate is checked against Gmail's name, not the bare address.
        tls: { servername: GMAIL_SMTP },
        auth: { user: this.user, pass: this.pass },
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
      });
      await transporter.sendMail({
        from: this.from,
        to: message.target,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      // Wrong app password, daily limit, no connection... Never log the code.
      this.logger.error(
        `Gmail refused the email: ${String(error).slice(0, 300)}`,
      );
      throw new ServiceUnavailableException(
        'We could not send the code right now. Please try again in a minute.',
      );
    }
    this.logger.log(`${message.reason} code emailed via Gmail.`);
  }
}

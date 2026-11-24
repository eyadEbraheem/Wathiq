import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildOtpEmail } from 'src/auth/otp/otp-email';
import { OtpMessage, OtpSender } from 'src/auth/otp/otp-sender';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

/**
 * Sends codes by email through Brevo's transactional API (docs/OUTSIDE-BOOTCAMP.md).
 * Uses Node's built-in fetch, no SDK. Email only: SMS codes are refused here.
 */
@Injectable()
export class BrevoOtpSender extends OtpSender {
  private readonly logger = new Logger(BrevoOtpSender.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(config: ConfigService) {
    super();
    this.apiKey = config.getOrThrow<string>('BREVO_API_KEY');
    this.fromEmail = config.getOrThrow<string>('EMAIL_FROM_ADDRESS');
    this.fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'واثق';
  }

  async send(message: OtpMessage): Promise<void> {
    if (message.channel !== 'EMAIL') {
      throw new ServiceUnavailableException(
        'Sending codes by SMS is not available yet.',
      );
    }

    const email = buildOtpEmail(message);
    let response: Response;
    try {
      response = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: message.target }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
          tags: [`otp-${message.reason.toLowerCase()}`],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Brevo request failed: ${String(error)}`);
      throw this.unavailable();
    }

    if (!response.ok) {
      // The body explains the problem (bad key, unverified sender, quota); never log the code.
      const detail = await response.text().catch(() => '');
      this.logger.error(
        `Brevo refused the email (${response.status}): ${detail.slice(0, 300)}`,
      );
      throw this.unavailable();
    }
    this.logger.log(`${message.reason} code emailed via Brevo.`);
  }

  private unavailable() {
    return new ServiceUnavailableException(
      'We could not send the code right now. Please try again in a minute.',
    );
  }
}

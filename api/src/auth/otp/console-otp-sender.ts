import { Injectable, Logger } from '@nestjs/common';
import { OtpMessage, OtpSender } from 'src/auth/otp/otp-sender';

/** Development sender: writes the code to the API log instead of sending it. */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger(ConsoleOtpSender.name);

  send(message: OtpMessage): Promise<void> {
    this.logger.warn(
      `[DEV ONLY] ${message.reason} code for ${message.channel} ${message.target}: ${message.code}`,
    );
    return Promise.resolve();
  }
}

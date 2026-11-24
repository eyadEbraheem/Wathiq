import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { GmailOtpSender } from 'src/auth/otp/gmail-otp-sender';
import type { OtpMessage } from 'src/auth/otp/otp-sender';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn().mockResolvedValue({ address: '173.194.69.108', family: 4 }),
}));

const config = new ConfigService({
  GMAIL_USER: 'wathiq.app@gmail.com',
  GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
  EMAIL_FROM_NAME: 'واثق',
});

const message: OtpMessage = {
  channel: 'EMAIL',
  target: 'sara@example.com',
  code: '483920',
  reason: 'SIGNUP',
  locale: 'ar',
  expiresInMinutes: 10,
};

describe('GmailOtpSender', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn();
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('logs in with the app password (spaces removed) and emails the code', async () => {
    sendMail.mockResolvedValue({ messageId: 'x' });

    await new GmailOtpSender(config).send(message);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '173.194.69.108',
        port: 465,
        secure: true,
        tls: { servername: 'smtp.gmail.com' },
        auth: { user: 'wathiq.app@gmail.com', pass: 'abcdefghijklmnop' },
      }),
    );
    const mail = sendMail.mock.calls[0][0] as Record<string, string>;
    expect(mail.from).toBe('"واثق" <wathiq.app@gmail.com>');
    expect(mail.to).toBe('sara@example.com');
    expect(mail.html).toContain('483920');
    expect(mail.text).toContain('483920');
  });

  it('turns a Gmail failure into 503 without leaking the code', async () => {
    sendMail.mockRejectedValue(
      new Error('535 Username and Password not accepted'),
    );

    const error = await new GmailOtpSender(config)
      .send(message)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(String((error as Error).message)).not.toContain('483920');
  });

  it('refuses SMS codes', async () => {
    await expect(
      new GmailOtpSender(config).send({ ...message, channel: 'SMS' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

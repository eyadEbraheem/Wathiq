import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoOtpSender } from 'src/auth/otp/brevo-otp-sender';
import type { OtpMessage } from 'src/auth/otp/otp-sender';

const config = new ConfigService({
  BREVO_API_KEY: 'test-key',
  EMAIL_FROM_ADDRESS: 'no-reply@wathiq.test',
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

describe('BrevoOtpSender', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the email to Brevo with the key, sender and code', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"messageId":"x"}', { status: 201 }),
    );

    await new BrevoOtpSender(config).send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe(
      'test-key',
    );

    const body = JSON.parse(init.body as string) as {
      sender: { email: string; name: string };
      to: { email: string }[];
      subject: string;
      htmlContent: string;
      textContent: string;
    };
    expect(body.sender).toEqual({
      email: 'no-reply@wathiq.test',
      name: 'واثق',
    });
    expect(body.to).toEqual([{ email: 'sara@example.com' }]);
    expect(body.subject).toBe('رمز تأكيد حسابك في واثق');
    expect(body.htmlContent).toContain('483920');
    expect(body.htmlContent).toContain('dir="rtl"');
    expect(body.textContent).toContain('483920');
  });

  it('writes the email in English for English users', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await new BrevoOtpSender(config).send({
      ...message,
      locale: 'en',
      reason: 'PASSWORD_RESET',
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as { subject: string; htmlContent: string };
    expect(body.subject).toBe('Your Wathiq password reset code');
    expect(body.htmlContent).toContain('dir="ltr"');
  });

  it('turns a Brevo error into 503 without leaking details', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"code":"unauthorized"}', { status: 401 }),
    );
    await expect(new BrevoOtpSender(config).send(message)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('turns a network failure into 503', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(new BrevoOtpSender(config).send(message)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('refuses SMS codes', async () => {
    await expect(
      new BrevoOtpSender(config).send({
        ...message,
        channel: 'SMS',
        target: '+963912345678',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

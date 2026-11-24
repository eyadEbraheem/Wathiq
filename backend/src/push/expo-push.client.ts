import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
export const EXPO_MAX_BATCH = 100;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
}

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

/**
 * Sends push messages through Expo's push service with plain HTTPS (`fetch`), no SDK.
 * Replaced by a fake in tests.
 */
@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);
  private readonly accessToken: string;

  constructor(config: ConfigService) {
    this.accessToken = config.get<string>('EXPO_ACCESS_TOKEN') ?? '';
  }

  /** One ticket per message, in the same order. Throws when Expo cannot be reached. */
  async send(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      throw new Error(`Expo push failed with HTTP ${response.status}.`);
    }
    const json = (await response.json()) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    if (tickets.length !== messages.length) {
      this.logger.warn(
        `Expo returned ${tickets.length} tickets for ${messages.length} messages.`,
      );
    }
    return tickets;
  }
}

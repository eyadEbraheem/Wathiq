import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushService } from 'src/push/push.service';

/**
 * Every 30 seconds: sends new notifications as push messages. Off unless PUSH_ENABLED=true,
 * so development and tests never call Expo.
 */
@Injectable()
export class PushJob {
  private readonly logger = new Logger(PushJob.name);
  private readonly enabled: boolean;
  private running = false;

  constructor(
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('PUSH_ENABLED') === 'true';
  }

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'push-notifications' })
  async deliver(): Promise<void> {
    // Skip a run while the previous one is still sending.
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      await this.push.deliverPending();
    } catch (error) {
      this.logger.error(
        'Push delivery run failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}

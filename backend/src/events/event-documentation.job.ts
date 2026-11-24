import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventDocumentationService } from 'src/events/event-documentation.service';

/** Every hour: tells admins about events still undocumented after their due date. */
@Injectable()
export class EventDocumentationJob {
  private readonly logger = new Logger(EventDocumentationJob.name);

  constructor(private readonly documentation: EventDocumentationService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'overdue-event-documentation' })
  async reportOverdue(): Promise<void> {
    try {
      await this.documentation.notifyOverdue();
    } catch (error) {
      // A failed run is retried by the next one (nothing was stamped).
      this.logger.error(
        'Overdue documentation check failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

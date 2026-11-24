import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HighlightsService } from 'src/highlights/highlights.service';

/** Saturday 00:05 Damascus: names the organization of the week that just ended. */
@Injectable()
export class HighlightsJob {
  private readonly logger = new Logger(HighlightsJob.name);

  constructor(private readonly highlights: HighlightsService) {}

  @Cron('5 0 * * 6', { name: 'weekly-highlight', timeZone: 'Asia/Damascus' })
  async run(): Promise<void> {
    try {
      await this.highlights.catchUp();
    } catch (error) {
      // Nothing was stored for a failed week, so the next run (or a restart) computes it.
      this.logger.error(
        'Weekly highlight failed.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

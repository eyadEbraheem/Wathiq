import { Module } from '@nestjs/common';
import { HighlightsController } from 'src/highlights/highlights.controller';
import { HighlightsJob } from 'src/highlights/highlights.job';
import { HighlightsService } from 'src/highlights/highlights.service';

@Module({
  controllers: [HighlightsController],
  providers: [HighlightsService, HighlightsJob],
  exports: [HighlightsService],
})
export class HighlightsModule {}

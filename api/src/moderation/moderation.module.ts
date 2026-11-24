import { Module } from '@nestjs/common';
import {
  AdminController,
  ReportsController,
} from 'src/moderation/moderation.controller';
import { ModerationService } from 'src/moderation/moderation.service';

@Module({
  controllers: [ReportsController, AdminController],
  providers: [ModerationService],
})
export class ModerationModule {}

import { Module } from '@nestjs/common';
import {
  AdminStatsController,
  MyStatsController,
} from 'src/stats/stats.controller';
import { StatsService } from 'src/stats/stats.service';

@Module({
  controllers: [AdminStatsController, MyStatsController],
  providers: [StatsService],
})
export class StatsModule {}

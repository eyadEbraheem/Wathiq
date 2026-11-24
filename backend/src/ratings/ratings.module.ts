import { Module } from '@nestjs/common';
import { RatingsController } from 'src/ratings/ratings.controller';
import { RatingsService } from 'src/ratings/ratings.service';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}

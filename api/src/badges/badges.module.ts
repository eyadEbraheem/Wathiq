import { Module } from '@nestjs/common';
import { BadgesController } from 'src/badges/badges.controller';
import { PublicBadgesController } from 'src/badges/public-badges.controller';
import { BadgesService } from 'src/badges/badges.service';

@Module({
  controllers: [BadgesController, PublicBadgesController],
  providers: [BadgesService],
})
export class BadgesModule {}

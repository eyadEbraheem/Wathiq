import { Module } from '@nestjs/common';
import { HighlightsModule } from 'src/highlights/highlights.module';
import { OrganizersController } from 'src/organizers/organizers.controller';
import { OrganizersService } from 'src/organizers/organizers.service';
import { RatingsModule } from 'src/ratings/ratings.module';

@Module({
  imports: [RatingsModule, HighlightsModule],
  controllers: [OrganizersController],
  providers: [OrganizersService],
})
export class OrganizersModule {}

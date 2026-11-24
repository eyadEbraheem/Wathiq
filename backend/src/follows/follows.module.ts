import { Module } from '@nestjs/common';
import { FollowsController } from 'src/follows/follows.controller';
import { FollowsService } from 'src/follows/follows.service';

@Module({
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}

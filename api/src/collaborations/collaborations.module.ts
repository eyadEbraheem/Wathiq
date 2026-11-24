import { Module } from '@nestjs/common';
import { CollaborationsController } from 'src/collaborations/collaborations.controller';
import { CollaborationsService } from 'src/collaborations/collaborations.service';

@Module({
  controllers: [CollaborationsController],
  providers: [CollaborationsService],
})
export class CollaborationsModule {}

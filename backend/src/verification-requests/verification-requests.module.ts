import { Module } from '@nestjs/common';
import { VerificationRequestsController } from 'src/verification-requests/verification-requests.controller';
import { VerificationRequestsService } from 'src/verification-requests/verification-requests.service';

@Module({
  controllers: [VerificationRequestsController],
  providers: [VerificationRequestsService],
})
export class VerificationRequestsModule {}

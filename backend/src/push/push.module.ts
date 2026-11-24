import { Module } from '@nestjs/common';
import { ExpoPushClient } from 'src/push/expo-push.client';
import { PushController } from 'src/push/push.controller';
import { PushJob } from 'src/push/push.job';
import { PushService } from 'src/push/push.service';

@Module({
  controllers: [PushController],
  providers: [PushService, PushJob, ExpoPushClient],
})
export class PushModule {}

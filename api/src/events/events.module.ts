import { Module } from '@nestjs/common';
import { EventApplicationsController } from 'src/events/event-applications.controller';
import { EventApplicationsService } from 'src/events/event-applications.service';
import {
  EventDocumentationController,
  ImpactLabelsController,
} from 'src/events/event-documentation.controller';
import { EventDocumentationJob } from 'src/events/event-documentation.job';
import { EventDocumentationService } from 'src/events/event-documentation.service';
import { EventsController } from 'src/events/events.controller';
import { EventsService } from 'src/events/events.service';
import { PostsModule } from 'src/posts/posts.module';

@Module({
  imports: [PostsModule],
  controllers: [
    EventsController,
    EventApplicationsController,
    EventDocumentationController,
    ImpactLabelsController,
  ],
  providers: [
    EventsService,
    EventApplicationsService,
    EventDocumentationService,
    EventDocumentationJob,
  ],
  exports: [EventDocumentationService],
})
export class EventsModule {}

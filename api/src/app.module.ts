import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from 'src/auth/auth.module';
import { BadgesModule } from 'src/badges/badges.module';
import { CollaborationsModule } from 'src/collaborations/collaborations.module';
import { CommentsModule } from 'src/comments/comments.module';
import { CvModule } from 'src/cv/cv.module';
import { EventsModule } from 'src/events/events.module';
import { FollowsModule } from 'src/follows/follows.module';
import { HighlightsModule } from 'src/highlights/highlights.module';
import { HealthController } from 'src/health/health.controller';
import { ModerationModule } from 'src/moderation/moderation.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrganizersModule } from 'src/organizers/organizers.module';
import { PostsModule } from 'src/posts/posts.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PushModule } from 'src/push/push.module';
import { PublishRequestsModule } from 'src/publish-requests/publish-requests.module';
import { RatingsModule } from 'src/ratings/ratings.module';
import { SearchModule } from 'src/search/search.module';
import { SectionsModule } from 'src/sections/sections.module';
import { StatsModule } from 'src/stats/stats.module';
import { StorageModule } from 'src/storage/storage.module';
import { TeamMembershipsModule } from 'src/team-memberships/team-memberships.module';
import { UsersModule } from 'src/users/users.module';
import { VerificationRequestsModule } from 'src/verification-requests/verification-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per-IP rate limit: 120 requests/minute by default; auth endpoints set stricter limits.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        skipIf: () => config.get<string>('NODE_ENV') === 'test',
      }),
    }),
    // Background jobs (overdue event documentation, push notifications).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    HighlightsModule,
    StatsModule,
    StorageModule,
    SectionsModule,
    UsersModule,
    VerificationRequestsModule,
    FollowsModule,
    TeamMembershipsModule,
    PostsModule,
    CommentsModule,
    EventsModule,
    BadgesModule,
    RatingsModule,
    OrganizersModule,
    SearchModule,
    CvModule,
    PublishRequestsModule,
    CollaborationsModule,
    ModerationModule,
    PushModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

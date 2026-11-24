import { Module } from '@nestjs/common';
import { PostsModule } from 'src/posts/posts.module';
import { PublishRequestsController } from 'src/publish-requests/publish-requests.controller';
import { PublishRequestsService } from 'src/publish-requests/publish-requests.service';

@Module({
  imports: [PostsModule],
  controllers: [PublishRequestsController],
  providers: [PublishRequestsService],
})
export class PublishRequestsModule {}

import { Module } from '@nestjs/common';
import { MyPostsController, PostsController } from 'src/posts/posts.controller';
import { PostsService } from 'src/posts/posts.service';

@Module({
  controllers: [PostsController, MyPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}

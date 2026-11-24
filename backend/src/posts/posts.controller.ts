import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { CreatePostDto } from 'src/posts/dto/create-post.dto';
import { FindMyPostsQueryDto } from 'src/posts/dto/find-my-posts-query.dto';
import { FindPostsQueryDto } from 'src/posts/dto/find-posts-query.dto';
import { UpdatePostDto } from 'src/posts/dto/update-post.dto';
import { PostsService } from 'src/posts/posts.service';

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Feed: published posts and events of a section (home section by default), newest or top',
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: FindPostsQueryDto) {
    return this.posts.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One post' })
  @ApiResponse({ status: 200, description: 'The post.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.posts.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Publish a post (verified accounts only); optionally a humanitarian case or an opportunity',
  })
  @ApiResponse({ status: 201, description: 'The new post.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid data, unknown image, topic outside the section, or details in the wrong section.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Not a verified account, or suspended.',
  })
  @ApiResponse({ status: 404, description: 'No such section.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit your own post (only the fields sent change)' })
  @ApiResponse({ status: 200, description: 'The updated post.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data, or the post is an event.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your post, or suspended.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post (its author or an admin)' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your post.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.posts.remove(user.id, id);
  }

  @Post(':id/upvote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upvote a post (idempotent)' })
  @ApiResponse({ status: 200, description: '{ upvoteCount, upvotedByMe }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  upvote(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.posts.upvote(user.id, id);
  }

  @Delete(':id/upvote')
  @ApiOperation({ summary: 'Remove your upvote (idempotent)' })
  @ApiResponse({ status: 200, description: '{ upvoteCount, upvotedByMe }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  removeUpvote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.posts.removeUpvote(user.id, id);
  }
}

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/posts')
export class MyPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({
    summary:
      "A verified account's own posts and events (including hidden ones), to find and manage them",
  })
  @ApiResponse({
    status: 200,
    description:
      '{ data: [PostView & { waiting: { applications, badges } | null }], meta, counts: { all, posts, events, hidden } }. waiting = pending applications and badge requests of an event.',
  })
  @ApiResponse({ status: 400, description: 'Invalid filter.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not a verified account.' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: FindMyPostsQueryDto) {
    return this.posts.findMine(user.id, query);
  }
}

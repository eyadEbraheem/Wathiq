import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { CommentsService } from 'src/comments/comments.service';
import { CreateCommentDto } from 'src/comments/dto/create-comment.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:postId/comments')
  @ApiOperation({
    summary: 'Comments of a post, oldest first, each with its replies',
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  findForPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.comments.findForPost(postId, query);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({
    summary: 'Comment on a post, or reply to a top-level comment',
  })
  @ApiResponse({ status: 201, description: 'The new comment.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid body, banned words, or the parent is missing or is a reply.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Suspended account.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.id, postId, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      "Delete a comment (its author, the post's author or an admin); replies go with it",
  })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not allowed.' })
  @ApiResponse({ status: 404, description: 'No such comment.' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.comments.remove(user.id, id);
  }
}

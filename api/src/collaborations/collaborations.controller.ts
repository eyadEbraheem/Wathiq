import {
  Body,
  Controller,
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
import { CollaborationsService } from 'src/collaborations/collaborations.service';
import {
  FindCollaborationsQueryDto,
  InviteCollaboratorDto,
} from 'src/collaborations/dto/collaboration.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';

@ApiTags('collaborations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CollaborationsController {
  constructor(private readonly collaborations: CollaborationsService) {}

  @Post('posts/:postId/collaborations')
  @ApiOperation({
    summary: 'Post author: invite an account to collaborate on the post',
  })
  @ApiResponse({ status: 201, description: 'The invitation (PENDING).' })
  @ApiResponse({ status: 400, description: 'Inviting yourself.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your post.' })
  @ApiResponse({ status: 404, description: 'No such post or user.' })
  @ApiResponse({ status: 409, description: 'Already invited.' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: InviteCollaboratorDto,
  ) {
    return this.collaborations.invite(user.id, postId, dto.inviteeId);
  }

  @Get('posts/:postId/collaborations')
  @ApiOperation({ summary: "Post author: the post's invitations" })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your post.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  findForPost(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: FindCollaborationsQueryDto,
  ) {
    return this.collaborations.findForPost(user.id, postId, query);
  }

  @Get('collaborations/incoming')
  @ApiOperation({ summary: 'Invitations you received' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findIncoming(
    @CurrentUser() user: AuthUser,
    @Query() query: FindCollaborationsQueryDto,
  ) {
    return this.collaborations.findIncoming(user.id, query);
  }

  @Post('collaborations/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept an invitation: you appear on the post and your followers are notified',
  })
  @ApiResponse({ status: 200, description: 'The collaboration (ACCEPTED).' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your invitation.' })
  @ApiResponse({ status: 404, description: 'No such invitation.' })
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.collaborations.accept(user.id, id);
  }

  @Post('collaborations/:id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline an invitation' })
  @ApiResponse({ status: 200, description: 'The collaboration (DECLINED).' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your invitation.' })
  @ApiResponse({ status: 404, description: 'No such invitation.' })
  decline(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.collaborations.decline(user.id, id);
  }

  @Post('collaborations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Post author: withdraw an invitation or remove a collaborator; invitee: leave',
  })
  @ApiResponse({ status: 200, description: 'The collaboration (CANCELLED).' })
  @ApiResponse({ status: 400, description: 'Nothing to cancel.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not yours.' })
  @ApiResponse({ status: 404, description: 'No such collaboration.' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.collaborations.cancel(user.id, id);
  }
}

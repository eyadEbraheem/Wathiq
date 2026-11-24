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
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireRole } from 'src/common/decorators/require-role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import {
  AddBannedWordDto,
  CreateReportDto,
  FindBannedWordsQueryDto,
  FindReportsQueryDto,
  ResolveReportDto,
} from 'src/moderation/dto/moderation.dto';
import { ModerationService } from 'src/moderation/moderation.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @ApiOperation({ summary: 'Report a post, a comment or a user to the admins' })
  @ApiResponse({ status: 201, description: '{ id, status }' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data, or reporting yourself.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such post, comment or user.' })
  @ApiResponse({
    status: 409,
    description: 'You already have an open report on it.',
  })
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.moderation.report(user.id, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole([UserRole.ADMIN])
@Controller('admin')
export class AdminController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('reports')
  @ApiOperation({ summary: 'Reports queue (OPEN by default), oldest first' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  findReports(@Query() query: FindReportsQueryDto) {
    return this.moderation.findReports(query);
  }

  @Post('reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resolve a report (and the other open ones on the same target); optionally hide the content and / or suspend its owner',
  })
  @ApiResponse({ status: 200, description: 'The report.' })
  @ApiResponse({
    status: 400,
    description: 'Already handled, hiding a user, or suspending an admin.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such report.' })
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderation.resolve(user.id, id, dto);
  }

  @Post('reports/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss a report (nothing wrong)' })
  @ApiResponse({ status: 200, description: 'The report.' })
  @ApiResponse({ status: 400, description: 'Already handled.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such report.' })
  dismiss(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.dismiss(user.id, id);
  }

  @Post('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide a published post' })
  @ApiResponse({ status: 200, description: '{ id, status }' })
  @ApiResponse({ status: 400, description: 'Already hidden.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  hidePost(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.hidePost(user.id, id, true);
  }

  @Post('posts/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a hidden post again' })
  @ApiResponse({ status: 200, description: '{ id, status }' })
  @ApiResponse({ status: 400, description: 'Not hidden.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such post.' })
  restorePost(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.hidePost(user.id, id, false);
  }

  @Post('comments/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide a comment' })
  @ApiResponse({ status: 200, description: '{ id, status }' })
  @ApiResponse({ status: 400, description: 'Already hidden.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such comment.' })
  hideComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.hideComment(user.id, id, true);
  }

  @Post('comments/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Show a hidden comment again' })
  @ApiResponse({ status: 200, description: '{ id, status }' })
  @ApiResponse({ status: 400, description: 'Not hidden.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such comment.' })
  restoreComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.hideComment(user.id, id, false);
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an account (it can read but not act)' })
  @ApiResponse({ status: 200, description: '{ id, isSuspended }' })
  @ApiResponse({
    status: 400,
    description: 'Yourself, an admin or the official account.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.setSuspended(user.id, id, true);
  }

  @Post('users/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lift a suspension' })
  @ApiResponse({ status: 200, description: '{ id, isSuspended }' })
  @ApiResponse({ status: 400, description: 'Yourself or an admin.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  unsuspend(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderation.setSuspended(user.id, id, false);
  }

  @Get('banned-words')
  @ApiOperation({ summary: 'The banned words list' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  findBannedWords(@Query() query: FindBannedWordsQueryDto) {
    return this.moderation.findBannedWords(query);
  }

  @Post('banned-words')
  @ApiOperation({
    summary:
      'Ban a word or phrase (matched as whole words after normalization)',
  })
  @ApiResponse({ status: 201, description: 'The banned word.' })
  @ApiResponse({ status: 400, description: 'Empty word.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 409, description: 'Already banned.' })
  addBannedWord(@CurrentUser() user: AuthUser, @Body() dto: AddBannedWordDto) {
    return this.moderation.addBannedWord(user.id, dto.word);
  }

  @Delete('banned-words/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a banned word' })
  @ApiResponse({ status: 204, description: 'Removed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  @ApiResponse({ status: 404, description: 'No such word.' })
  removeBannedWord(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.moderation.removeBannedWord(user.id, id);
  }
}

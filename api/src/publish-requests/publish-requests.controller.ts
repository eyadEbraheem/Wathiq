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
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireRole } from 'src/common/decorators/require-role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import {
  ApprovePublishRequestDto,
  CreatePublishRequestDto,
  FindPublishRequestsQueryDto,
  RejectPublishRequestDto,
} from 'src/publish-requests/dto/publish-request.dto';
import { PublishRequestsService } from 'src/publish-requests/publish-requests.service';

@ApiTags('publish-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('publish-requests')
export class PublishRequestsController {
  constructor(private readonly requests: PublishRequestsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Regular users: ask a verified account (targetUserId) or the platform (no target) to publish a post or a humanitarian case',
  })
  @ApiResponse({ status: 201, description: 'The request (PENDING).' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid data, verified caller, account not accepting requests, case outside humanitarian, missing / extra attribution.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Suspended.' })
  @ApiResponse({ status: 404, description: 'No such account or section.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublishRequestDto) {
    return this.requests.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'The requests you sent' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: FindPublishRequestsQueryDto,
  ) {
    return this.requests.findMine(user.id, query);
  }

  @Get('incoming')
  @ApiOperation({ summary: 'Verified accounts: requests sent to you' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findIncoming(
    @CurrentUser() user: AuthUser,
    @Query() query: FindPublishRequestsQueryDto,
  ) {
    return this.requests.findIncoming(user.id, query);
  }

  @Get('platform')
  @RequireRole([UserRole.ADMIN])
  @ApiOperation({ summary: 'Admins: requests sent to the platform' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  findForPlatform(@Query() query: FindPublishRequestsQueryDto) {
    return this.requests.findForPlatform(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One request (requester, target account, or admin)',
  })
  @ApiResponse({ status: 200, description: 'The request.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not yours.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.requests.findOne(user.id, id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'The target account (or an admin for platform requests): publish it as a post',
  })
  @ApiResponse({
    status: 200,
    description: 'The request (APPROVED, with resultingPostId).',
  })
  @ApiResponse({
    status: 400,
    description: 'Not pending, missing attribution, or invalid topics.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not the target / not an admin.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  @ApiResponse({ status: 409, description: 'Decided in the meantime.' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApprovePublishRequestDto,
  ) {
    return this.requests.approve(user.id, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'The target account (or an admin): reject, with an optional reason',
  })
  @ApiResponse({ status: 200, description: 'The request (REJECTED).' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not the target / not an admin.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectPublishRequestDto,
  ) {
    return this.requests.reject(user.id, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'The requester: cancel a pending request' })
  @ApiResponse({ status: 200, description: 'The request (CANCELLED).' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your request.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.requests.cancel(user.id, id);
  }
}

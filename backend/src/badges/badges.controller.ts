import {
  Body,
  Controller,
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
import { BadgesService } from 'src/badges/badges.service';
import {
  ApproveBadgeDto,
  FindBadgesQueryDto,
  RequestBadgeDto,
  UpdateBadgeDto,
} from 'src/badges/dto/badge.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';

@ApiTags('badges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('badges')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Request a badge for your accepted application to a completed event (again after a rejection)',
  })
  @ApiResponse({ status: 201, description: 'The badge (REQUESTED).' })
  @ApiResponse({
    status: 400,
    description: 'Not accepted, or the event is not completed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your application.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  @ApiResponse({
    status: 409,
    description: 'Already requested or approved.',
  })
  request(@CurrentUser() user: AuthUser, @Body() dto: RequestBadgeDto) {
    return this.badges.request(user.id, dto.applicationId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Your badges in every state' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(@CurrentUser() user: AuthUser, @Query() query: FindBadgesQueryDto) {
    return this.badges.findMine(user.id, query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: "A profile's approved badges (the ones the holder shows)",
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findForUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: FindBadgesQueryDto,
  ) {
    return this.badges.findForUser(userId, query);
  }

  @Get('event/:eventId')
  @ApiOperation({ summary: "Organizer: an event's badges (filter by status)" })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  findForEvent(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: FindBadgesQueryDto,
  ) {
    return this.badges.findForEvent(user.id, eventId, query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Organizer: approve a requested badge' })
  @ApiResponse({ status: 200, description: 'The badge (APPROVED).' })
  @ApiResponse({
    status: 400,
    description: 'Not requested, or the event is not completed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such badge.' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveBadgeDto,
  ) {
    return this.badges.approve(user.id, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Organizer: reject a requested badge' })
  @ApiResponse({ status: 200, description: 'The badge (REJECTED).' })
  @ApiResponse({
    status: 400,
    description: 'Not requested, or the event is not completed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such badge.' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.badges.reject(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Show or hide your badge on your profile' })
  @ApiResponse({ status: 200, description: 'The badge.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your badge.' })
  @ApiResponse({ status: 404, description: 'No such badge.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBadgeDto,
  ) {
    return this.badges.setShown(user.id, id, dto.isShownOnProfile);
  }
}

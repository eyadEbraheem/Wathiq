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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import {
  AcceptApplicationDto,
  MoveApplicationDto,
} from 'src/events/dto/application-role.dto';
import { FindApplicationsQueryDto } from 'src/events/dto/find-applications-query.dto';
import { EventApplicationsService } from 'src/events/event-applications.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('event-applications')
export class EventApplicationsController {
  constructor(private readonly applications: EventApplicationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Your applications, newest first, with the event' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: FindApplicationsQueryDto,
  ) {
    return this.applications.findMine(user.id, query);
  }

  @Get('organizer')
  @ApiOperation({
    summary:
      "Organizer: applications to all of your events, oldest first, with the event and each applicant's visible profile",
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findForOrganizer(
    @CurrentUser() user: AuthUser,
    @Query() query: FindApplicationsQueryDto,
  ) {
    return this.applications.findForOrganizer(user.id, query);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Withdraw your pending or accepted application (may reopen a full event)',
  })
  @ApiResponse({ status: 200, description: 'The application (WITHDRAWN).' })
  @ApiResponse({
    status: 400,
    description: 'Already decided / withdrawn, or the event is over.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your application.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applications.withdraw(user.id, id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Organizer: accept a pending applicant (into one role with a free seat if the event has roles)',
  })
  @ApiResponse({ status: 200, description: 'The application (ACCEPTED).' })
  @ApiResponse({
    status: 400,
    description: 'Not pending, missing / unknown role, event over.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  @ApiResponse({ status: 409, description: 'The event or role is full.' })
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcceptApplicationDto,
  ) {
    return this.applications.accept(user.id, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Organizer: reject a pending applicant' })
  @ApiResponse({ status: 200, description: 'The application (REJECTED).' })
  @ApiResponse({ status: 400, description: 'Not pending, or event over.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.applications.reject(user.id, id);
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Organizer: move an accepted volunteer to another role with a free seat',
  })
  @ApiResponse({ status: 200, description: 'The application.' })
  @ApiResponse({
    status: 400,
    description: 'Not accepted, same role, unknown role, or event over.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  @ApiResponse({ status: 409, description: 'The role is full.' })
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveApplicationDto,
  ) {
    return this.applications.move(user.id, id, dto);
  }
}

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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { ApplyEventDto } from 'src/events/dto/apply-event.dto';
import { CloneEventDto } from 'src/events/dto/clone-event.dto';
import { CreateEventDto } from 'src/events/dto/create-event.dto';
import { FindApplicationsQueryDto } from 'src/events/dto/find-applications-query.dto';
import { FindEventsQueryDto } from 'src/events/dto/find-events-query.dto';
import { UpdateEventDto } from 'src/events/dto/update-event.dto';
import { EventApplicationsService } from 'src/events/event-applications.service';
import { EventsService } from 'src/events/events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly applications: EventApplicationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Published events, soonest first (filter by section, topic, organizer, governorate, status)',
  })
  @ApiResponse({ status: 200, description: '{ data, meta } of post views.' })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: FindEventsQueryDto) {
    return this.events.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'One event: the post view plus roles (seats left), questions and myApplication',
  })
  @ApiResponse({ status: 200, description: 'The event.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.events.findOne(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create an event (verified accounts only), optionally with roles and questions',
  })
  @ApiResponse({ status: 201, description: 'The new event.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid data or dates, unknown image, topic outside the section, capacity with roles.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Not a verified account, or suspended.',
  })
  @ApiResponse({ status: 404, description: 'No such section.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Edit your OPEN or CLOSED event (only the fields sent change; questions lock once people apply)',
  })
  @ApiResponse({ status: 200, description: 'The updated event.' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid data, completed / cancelled event, capacity below accepted volunteers.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event, or suspended.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  @ApiResponse({
    status: 409,
    description: 'Removing a role that applicants chose or hold.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(user.id, id, dto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop applications by hand (OPEN → CLOSED; it will not reopen)',
  })
  @ApiResponse({ status: 200, description: 'The event.' })
  @ApiResponse({
    status: 400,
    description: 'Already closed, completed or cancelled.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  close(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.events.close(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel the event (any state); applicants are notified',
  })
  @ApiResponse({ status: 200, description: 'The event.' })
  @ApiResponse({ status: 400, description: 'Already cancelled.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.events.cancel(user.id, id);
  }

  @Post(':id/clone')
  @ApiOperation({
    summary:
      'New OPEN event copied from one of yours (details, images, roles, questions, topics); set new dates',
  })
  @ApiResponse({ status: 201, description: 'The new event.' })
  @ApiResponse({ status: 400, description: 'Invalid dates or unknown image.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Not your event, not verified, or suspended.',
  })
  @ApiResponse({ status: 404, description: 'No such event.' })
  clone(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloneEventDto,
  ) {
    return this.events.clone(user.id, id, dto);
  }

  @Post(':id/applications')
  @ApiOperation({
    summary:
      'Apply (people only: not the organizer, not an organization): 1-3 ranked roles when the event has roles, plus answers',
  })
  @ApiResponse({ status: 201, description: 'Your application (PENDING).' })
  @ApiResponse({
    status: 400,
    description:
      'Event not open, deadline passed, too young on the event date, bad roles or answers.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Your own event, an organization account, or suspended.',
  })
  @ApiResponse({ status: 404, description: 'No such event.' })
  @ApiResponse({ status: 409, description: 'Already applied.' })
  apply(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyEventDto,
  ) {
    return this.applications.apply(user.id, id, dto);
  }

  @Get(':id/applications')
  @ApiOperation({
    summary:
      "Organizer: the event's applications with each applicant's visible profile",
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  findApplications(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FindApplicationsQueryDto,
  ) {
    return this.applications.findForEvent(user.id, id, query);
  }
}

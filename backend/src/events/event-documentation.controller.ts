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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import {
  DocumentEventDto,
  UpdateDocumentationDto,
} from 'src/events/dto/document-event.dto';
import { EventDocumentationService } from 'src/events/event-documentation.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventDocumentationController {
  constructor(private readonly documentation: EventDocumentationService) {}

  @Post(':id/documentation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Organizer: document the event (text + photos, optional impact metrics) → COMPLETED',
  })
  @ApiResponse({ status: 200, description: 'The event (COMPLETED).' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid data, not started yet, already documented, cancelled, duplicate metric label.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event, or suspended.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  document(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DocumentEventDto,
  ) {
    return this.documentation.document(user.id, id, dto);
  }

  @Patch(':id/documentation')
  @ApiOperation({
    summary:
      'Organizer: edit the documentation of a completed event (only the fields sent change)',
  })
  @ApiResponse({ status: 200, description: 'The event.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data, or the event is not completed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your event, or suspended.' })
  @ApiResponse({ status: 404, description: 'No such event.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentationDto,
  ) {
    return this.documentation.update(user.id, id, dto);
  }
}

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('impact-labels')
export class ImpactLabelsController {
  constructor(private readonly documentation: EventDocumentationService) {}

  @Get()
  @ApiOperation({
    summary:
      'Your past impact metric labels, most used first (suggestions while typing)',
  })
  @ApiQuery({ name: 'q', required: false, example: 'اشجار' })
  @ApiResponse({ status: 200, description: '{ data: [{ label, uses }] }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  suggestions(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.documentation.labelSuggestions(
      user.id,
      typeof q === 'string' ? q.slice(0, 60) : undefined,
    );
  }
}

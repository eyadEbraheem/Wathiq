import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { RateEventDto } from 'src/ratings/dto/rate-event.dto';
import { RatingsService } from 'src/ratings/ratings.service';

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Put()
  @ApiOperation({
    summary:
      "Rate an event's organizer 1-5 stars, or change your rating (30 days after documentation)",
  })
  @ApiResponse({
    status: 200,
    description: '{ id, stars, applicationId, editableUntil, ... }',
  })
  @ApiResponse({
    status: 400,
    description: 'Not accepted, event not completed, or the window closed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your application.' })
  @ApiResponse({ status: 404, description: 'No such application.' })
  rate(@CurrentUser() user: AuthUser, @Body() dto: RateEventDto) {
    return this.ratings.rate(user.id, dto.applicationId, dto.stars);
  }

  @Get('received')
  @ApiOperation({
    summary: 'Organizer: the ratings you received, with who gave them',
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  received(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.ratings.received(user.id, query);
  }
}

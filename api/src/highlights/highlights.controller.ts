import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { HighlightsService } from 'src/highlights/highlights.service';

/** Public: the home page shows the organization of the week to visitors too. */
@ApiTags('highlights')
@Controller('highlights')
export class HighlightsController {
  constructor(private readonly highlights: HighlightsService) {}

  @Get('current')
  @ApiOperation({
    summary:
      'Organization of the week: the latest finished week (Saturday to Friday, Damascus)',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ weekStart, weekEnd, newVolunteers, organizer: { id, name, avatarUrl, verifiedKind, isPartner, isOfficial, city, governorate } | null }. organizer is null when nobody brought enough first-time volunteers that week.',
  })
  @ApiResponse({ status: 404, description: 'No week computed yet.' })
  current() {
    return this.highlights.current();
  }

  @Get()
  @ApiOperation({
    summary: 'Honour board: every organization of the week, newest first',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: [same shape as GET /highlights/current], meta }',
  })
  @ApiResponse({ status: 400, description: 'Invalid page or limit.' })
  history(@Query() query: PaginationQueryDto) {
    return this.highlights.history(query);
  }
}

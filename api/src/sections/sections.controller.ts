import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { SectionsService } from 'src/sections/sections.service';

@ApiTags('sections')
@Controller('sections')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  @ApiOperation({ summary: 'The sections with their active topics (public)' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 400, description: 'Invalid page or limit.' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.sections.findAll(query);
  }
}

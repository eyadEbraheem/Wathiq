import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  DirectoryQueryDto,
  SearchAccountsQueryDto,
  SearchPeopleQueryDto,
} from 'src/search/dto/search.dto';
import { SearchService } from 'src/search/search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('accounts')
  @ApiOperation({
    summary:
      'Search verified accounts by name, region (governorate / city) and specialty',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: [card + bio, region, specialties], meta }',
  })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  accounts(@Query() query: SearchAccountsQueryDto) {
    return this.search.accounts(query);
  }

  @Get('directory')
  @ApiOperation({
    summary:
      'Directory of verified accounts, optionally by section of interest; best public rating first',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ data: [card + bio, region, specialties, sectionIds, completedEvents, rating: { hidden, average, count }], meta, sections: [{ sectionId, count }] }',
  })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  directory(@Query() query: DirectoryQueryDto) {
    return this.search.directory(query);
  }

  @Get('accounts/regions')
  @ApiOperation({
    summary:
      'Region filter values: governorates and cities verified accounts show',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ data: [{ governorate, accounts, cities: [{ city, accounts }] }] }',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  regions() {
    return this.search.accountRegions();
  }

  @Get('people')
  @ApiOperation({
    summary:
      'Verified accounts: search people (only fields each person made visible can match)',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: [public profile + completedVolunteering], meta }',
  })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not a verified account.' })
  people(@CurrentUser() user: AuthUser, @Query() query: SearchPeopleQueryDto) {
    return this.search.people(user.id, query);
  }
}

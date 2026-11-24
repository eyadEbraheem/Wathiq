import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { TeamMembershipsService } from 'src/team-memberships/team-memberships.service';

/** Public lists shown on profiles. */
@ApiTags('team-memberships')
@Controller('users')
export class UserTeamsController {
  constructor(private readonly memberships: TeamMembershipsService) {}

  @Get(':id/teams')
  @ApiOperation({
    summary:
      "Teams on a user's profile (approved; respects showTeams and the under-18 rule)",
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  teams(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.memberships.teamsOf(id, query);
  }

  @Get(':id/members')
  @ApiOperation({
    summary: 'Approved members of a team (adults who show their teams)',
  })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 404, description: 'No such team.' })
  members(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.memberships.membersOf(id, query);
  }
}

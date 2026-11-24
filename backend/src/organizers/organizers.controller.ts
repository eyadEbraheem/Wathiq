import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
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
  FindSpecialtiesQueryDto,
  SetSpecialtiesDto,
} from 'src/organizers/dto/organizers.dto';
import { OrganizersService } from 'src/organizers/organizers.service';

@ApiTags('organizers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class OrganizersController {
  constructor(private readonly organizers: OrganizersService) {}

  @Get('users/me/specialties')
  @ApiOperation({ summary: 'Your specialties' })
  @ApiResponse({ status: 200, description: '{ data: [{ id, name }] }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  mySpecialties(@CurrentUser() user: AuthUser) {
    return this.organizers.mySpecialties(user.id);
  }

  @Put('users/me/specialties')
  @ApiOperation({
    summary:
      'Verified accounts: replace your specialties (same names after normalization reuse one entry)',
  })
  @ApiResponse({ status: 200, description: '{ data: [{ id, name }] }' })
  @ApiResponse({ status: 400, description: 'Invalid names.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not a verified account.' })
  setSpecialties(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetSpecialtiesDto,
  ) {
    return this.organizers.setSpecialties(user.id, dto.names);
  }

  @Get('specialties')
  @ApiOperation({
    summary:
      'Specialties of verified accounts, most used first (suggestions and the search filter list)',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: [{ id, name, accounts }], meta }',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findSpecialties(@Query() query: FindSpecialtiesQueryDto) {
    return this.organizers.findSpecialties(query);
  }

  @Get('users/:id/organizer-stats')
  @ApiOperation({
    summary:
      'A verified account: completed events, accepted volunteers, impact totals and rating',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ completedEvents, acceptedVolunteers, impact: [{ label, total }], rating: { hidden, enoughRatings, average, count }, weeklyHighlights }. weeklyHighlights = weeks this account was organization of the week.',
  })
  @ApiResponse({ status: 400, description: 'Not a verified account.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  stats(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.organizers.stats(user.id, id);
  }
}

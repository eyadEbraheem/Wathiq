import {
  Body,
  Controller,
  Delete,
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
import { CreateTeamMembershipDto } from 'src/team-memberships/dto/create-team-membership.dto';
import { FindTeamMembershipsQueryDto } from 'src/team-memberships/dto/find-team-memberships-query.dto';
import { UpdateTeamMembershipDto } from 'src/team-memberships/dto/update-team-membership.dto';
import { TeamMembershipsService } from 'src/team-memberships/team-memberships.service';

@ApiTags('team-memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-memberships')
export class TeamMembershipsController {
  constructor(private readonly memberships: TeamMembershipsService) {}

  // ── Member side ───────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Ask a verified team to list you as a member' })
  @ApiResponse({ status: 201, description: 'Request sent to the team.' })
  @ApiResponse({
    status: 400,
    description: 'Not a verified team, yourself, or invalid years.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Organizations cannot join teams.',
  })
  @ApiResponse({ status: 404, description: 'No such team.' })
  @ApiResponse({
    status: 409,
    description: 'Already pending or approved with this team.',
  })
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateTeamMembershipDto) {
    return this.memberships.create(me.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Your memberships (any status)' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(
    @CurrentUser() me: AuthUser,
    @Query() query: FindTeamMembershipsQueryDto,
  ) {
    return this.memberships.findMine(me.id, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit your role, description or years' })
  @ApiResponse({ status: 200, description: 'The updated membership.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid years, or rejected/removed.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your membership.' })
  @ApiResponse({ status: 404, description: 'No such membership.' })
  update(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamMembershipDto,
  ) {
    return this.memberships.update(me.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel your pending request' })
  @ApiResponse({ status: 204, description: 'Cancelled.' })
  @ApiResponse({ status: 400, description: 'Not pending any more.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your membership.' })
  @ApiResponse({ status: 404, description: 'No such membership.' })
  async cancel(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.memberships.cancel(me.id, id);
  }

  // ── Team side ─────────────────────────────────────────────────────────────

  @Get('incoming')
  @ApiOperation({ summary: 'Membership requests and members of your team' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findIncoming(
    @CurrentUser() me: AuthUser,
    @Query() query: FindTeamMembershipsQueryDto,
  ) {
    return this.memberships.findIncoming(me.id, query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "[Team] Approve: shows on the member's profile" })
  @ApiResponse({ status: 200, description: 'The approved membership.' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your team.' })
  @ApiResponse({ status: 404, description: 'No such membership.' })
  approve(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.memberships.approve(me.id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Team] Reject a pending request' })
  @ApiResponse({ status: 200, description: 'The rejected membership.' })
  @ApiResponse({ status: 400, description: 'Not pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your team.' })
  @ApiResponse({ status: 404, description: 'No such membership.' })
  reject(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.memberships.reject(me.id, id);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Team] Remove an approved member' })
  @ApiResponse({ status: 200, description: 'The removed membership.' })
  @ApiResponse({ status: 400, description: 'Not approved.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not your team.' })
  @ApiResponse({ status: 404, description: 'No such membership.' })
  remove(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.memberships.remove(me.id, id);
  }
}

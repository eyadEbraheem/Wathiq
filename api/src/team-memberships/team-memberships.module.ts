import { Module } from '@nestjs/common';
import { TeamMembershipsController } from 'src/team-memberships/team-memberships.controller';
import { TeamMembershipsService } from 'src/team-memberships/team-memberships.service';
import { UserTeamsController } from 'src/team-memberships/user-teams.controller';

@Module({
  controllers: [TeamMembershipsController, UserTeamsController],
  providers: [TeamMembershipsService],
})
export class TeamMembershipsModule {}

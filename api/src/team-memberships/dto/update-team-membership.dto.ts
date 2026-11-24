import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTeamMembershipDto } from 'src/team-memberships/dto/create-team-membership.dto';

/** The member edits their own description of the membership; the team cannot be changed. */
export class UpdateTeamMembershipDto extends PartialType(
  OmitType(CreateTeamMembershipDto, ['teamId'] as const),
) {}

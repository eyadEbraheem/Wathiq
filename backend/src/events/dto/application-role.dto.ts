import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Accepting an applicant. */
export class AcceptApplicationDto {
  @ApiPropertyOptional({
    example: 4,
    description:
      'Required when the event has roles: the one role the volunteer gets (needs a free seat).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  roleId?: number;
}

/** Moving an accepted volunteer to another role. */
export class MoveApplicationDto {
  @ApiProperty({
    example: 6,
    description: 'A role of the same event with a free seat.',
  })
  @IsInt()
  @Min(1)
  roleId: number;
}

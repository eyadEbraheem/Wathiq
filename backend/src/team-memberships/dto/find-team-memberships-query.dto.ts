import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindTeamMembershipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: MembershipStatus,
    example: MembershipStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

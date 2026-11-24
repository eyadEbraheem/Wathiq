import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindVerificationRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: VerificationStatus,
    example: VerificationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CollaborationStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class InviteCollaboratorDto {
  @ApiProperty({
    example: 15,
    description: 'The account to invite (any account).',
  })
  @IsInt()
  @Min(1)
  inviteeId: number;
}

export class FindCollaborationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CollaborationStatus })
  @IsOptional()
  @IsEnum(CollaborationStatus)
  status?: CollaborationStatus;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadgeStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class RequestBadgeDto {
  @ApiProperty({
    example: 12,
    description:
      'Your ACCEPTED application to a COMPLETED event (one badge per application).',
  })
  @IsInt()
  @Min(1)
  applicationId: number;
}

export class ApproveBadgeDto {
  @ApiPropertyOptional({ example: 'شكراً لجهودك في تنظيم الحملة.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateBadgeDto {
  @ApiProperty({
    example: false,
    description: 'Show or hide this approved badge on your profile.',
  })
  @IsBoolean()
  isShownOnProfile: boolean;
}

export class FindBadgesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BadgeStatus })
  @IsOptional()
  @IsEnum(BadgeStatus)
  status?: BadgeStatus;
}

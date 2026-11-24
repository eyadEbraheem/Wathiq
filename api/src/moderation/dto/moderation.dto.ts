import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason, ReportStatus, ReportTarget } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTarget, example: ReportTarget.POST })
  @IsEnum(ReportTarget)
  target: ReportTarget;

  @ApiProperty({
    example: 42,
    description: 'The id of the post, comment or user reported.',
  })
  @IsInt()
  @Min(1)
  targetId: number;

  @ApiProperty({ enum: ReportReason, example: ReportReason.FRAUD })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ example: 'رقم الهاتف لا يعود لعائلة الطفلة.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class FindReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.OPEN })
  @IsOptional()
  @IsEnum(ReportStatus)
  status: ReportStatus = ReportStatus.OPEN;

  @ApiPropertyOptional({ enum: ReportTarget })
  @IsOptional()
  @IsEnum(ReportTarget)
  target?: ReportTarget;
}

export class ResolveReportDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Hide the reported post or comment.',
  })
  @IsOptional()
  @IsBoolean()
  hideContent?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Suspend the reported user, or the author of the reported content.',
  })
  @IsOptional()
  @IsBoolean()
  suspendUser?: boolean;
}

export class AddBannedWordDto {
  @ApiProperty({ example: 'كلمة' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  word: string;
}

export class FindBannedWordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'كل' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(60)
  q?: string;
}

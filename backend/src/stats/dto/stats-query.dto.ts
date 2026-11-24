import { STATS_PERIODS, type StatsPeriod } from '@csh/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Governorate } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';

/** Filters of a statistics report (and of its CSV). */
export class StatsQueryDto {
  @ApiPropertyOptional({
    enum: STATS_PERIODS,
    default: '365d',
    example: '90d',
    description: 'Window counted back from today.',
  })
  @IsOptional()
  @IsIn(STATS_PERIODS)
  period: StatsPeriod = '365d';

  @ApiPropertyOptional({ enum: Governorate, example: Governorate.ALEPPO })
  @IsOptional()
  @IsEnum(Governorate)
  governorate?: Governorate;

  @ApiPropertyOptional({ example: 2, description: 'Only this section.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}

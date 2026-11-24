import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus, Governorate } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

/** Published events, soonest first. */
export class FindEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;

  @ApiPropertyOptional({ example: 12, description: "One organizer's events." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({ enum: Governorate })
  @IsOptional()
  @IsEnum(Governorate)
  governorate?: Governorate;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

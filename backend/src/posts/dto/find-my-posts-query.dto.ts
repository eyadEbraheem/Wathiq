import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus, PostKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { POST_SORTS, type PostSort } from 'src/posts/dto/find-posts-query.dto';

/** Filters of a verified account's own posts and events (GET /users/me/posts). */
export class FindMyPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: PostKind,
    example: PostKind.EVENT,
    description: 'Only posts or only events. Omit for both.',
  })
  @IsOptional()
  @IsEnum(PostKind)
  kind?: PostKind;

  @ApiPropertyOptional({
    enum: EventStatus,
    example: EventStatus.OPEN,
    description: 'Only events in this status (implies kind=EVENT).',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  eventStatus?: EventStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'Only what the admins hid (true). Omit for everything.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ example: 'تشجير', description: 'Words in the title.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: POST_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(POST_SORTS)
  sort: PostSort = 'newest';
}

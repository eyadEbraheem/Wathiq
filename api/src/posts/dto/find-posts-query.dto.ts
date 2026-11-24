import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export const POST_SORTS = ['newest', 'top'] as const;
export type PostSort = (typeof POST_SORTS)[number];

export class FindPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      "Section to list. Without sectionId and authorId: the caller's home section " +
      '(primary section, humanitarian if none).',
  })
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

  @ApiPropertyOptional({ example: 12, description: "One account's posts." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorId?: number;

  @ApiPropertyOptional({ enum: POST_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(POST_SORTS)
  sort: PostSort = 'newest';

  @ApiPropertyOptional({
    example: true,
    description:
      'Only humanitarian cases (true) or only normal posts (false). Omit for both.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  cases?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Only external opportunities still open for applications (deadline not passed).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  openOpportunities?: boolean;
}

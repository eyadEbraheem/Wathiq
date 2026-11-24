import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export class CreateCommentDto {
  @ApiProperty({ example: 'شكراً لجهودكم، كيف يمكنني المشاركة؟' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Reply to this top-level comment (one level of replies only).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number;
}

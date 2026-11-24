import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import {
  CaseDetailsDto,
  OpportunityDetailsDto,
} from 'src/posts/dto/post-details.dto';

export const MAX_POST_IMAGES = 10;
export const MAX_POST_TOPICS = 5;

export class CreatePostDto {
  @ApiProperty({ example: 2, description: 'The section the post belongs to.' })
  @IsInt()
  @Min(1)
  sectionId: number;

  @ApiProperty({ example: 'ثلاث قطط صغيرة تبحث عن بيت' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'وجدناهم قرب السوق القديم، تلقّوا اللقاحات الأولى.' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    example: [7, 9],
    description: `Topics of the same section (max ${MAX_POST_TOPICS}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_TOPICS)
  @ArrayUnique()
  @IsInt({ each: true })
  topicIds?: number[];

  @ApiPropertyOptional({
    example: ['public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.jpg'],
    description: `Image keys from POST /uploads/images, in display order (max ${MAX_POST_IMAGES}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  imageKeys?: string[];

  @ApiPropertyOptional({
    type: CaseDetailsDto,
    nullable: true,
    description:
      'Humanitarian section only: makes the post a humanitarian case.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseDetailsDto)
  caseDetails?: CaseDetailsDto | null;

  @ApiPropertyOptional({
    type: OpportunityDetailsDto,
    nullable: true,
    description: 'Education section only: an external opportunity.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpportunityDetailsDto)
  opportunity?: OpportunityDetailsDto | null;
}

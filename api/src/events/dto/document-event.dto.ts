import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export const MAX_DOCUMENTATION_IMAGES = 20;
export const MAX_IMPACT_METRICS = 10;

/** One number the event achieved, e.g. "أشجار مزروعة" = 300. */
export class ImpactMetricDto {
  @ApiProperty({ example: 'أشجار مزروعة' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @ApiProperty({ example: 300, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  value: number;
}

/** Documenting an event: it becomes COMPLETED. */
export class DocumentEventDto {
  @ApiProperty({
    example: 'زرعنا 300 شجرة مع 25 متطوعاً من أهالي الحي خلال أربع ساعات.',
  })
  @Trim()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  documentation: string;

  @ApiProperty({
    example: ['public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.jpg'],
    description: `Photos of the event from POST /uploads/images (1 to ${MAX_DOCUMENTATION_IMAGES}).`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DOCUMENTATION_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  imageKeys: string[];

  @ApiPropertyOptional({
    type: [ImpactMetricDto],
    description: `Optional impact numbers (max ${MAX_IMPACT_METRICS}); labels unique after Arabic normalization.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMPACT_METRICS)
  @ValidateNested({ each: true })
  @Type(() => ImpactMetricDto)
  metrics?: ImpactMetricDto[];
}

/** Editing the documentation of a COMPLETED event: only the fields sent change. */
export class UpdateDocumentationDto extends PartialType(DocumentEventDto) {}

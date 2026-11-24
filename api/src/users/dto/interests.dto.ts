import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

export class SetInterestsDto {
  @ApiProperty({ example: [1, 3], description: 'At least one section.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  sectionIds: number[];

  @ApiProperty({
    example: [2, 11],
    description:
      'At least one topic; each must belong to one of the chosen sections.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  topicIds: number[];

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description:
      'Home section; must be one of sectionIds. Omit to keep the current one if still chosen.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(1)
  primarySectionId?: number | null;
}

export class SetPrimarySectionDto {
  @ApiProperty({
    example: 3,
    nullable: true,
    description:
      'One of your section interests, or null for the default (humanitarian).',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsInt()
  @Min(1)
  sectionId: number | null;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel, Governorate } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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

export class SearchAccountsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'فريق الخير',
    description: 'Name (Arabic-normalized).',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: Governorate })
  @IsOptional()
  @IsEnum(Governorate)
  governorate?: Governorate;

  @ApiPropertyOptional({
    example: 'حمص',
    description: 'A city from GET /search/accounts/regions.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'A specialty id from GET /specialties.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;
}

export class SearchPeopleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'سامر',
    description: 'Name (Arabic-normalized).',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: Governorate })
  @IsOptional()
  @IsEnum(Governorate)
  governorate?: Governorate;

  @ApiPropertyOptional({ example: 'حمص' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional({
    example: 'هندسة',
    description: 'Part of the field of study.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  fieldOfStudy?: string;

  @ApiPropertyOptional({
    example: 'تصميم',
    description: 'Part of the work field.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  workField?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Only people accepted in at least one completed event.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  hasVolunteered?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Interested in this section.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({ example: 7, description: 'Interested in this topic.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;
}

export class DirectoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      'Only accounts in this section: chosen as an interest, or published in it.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}

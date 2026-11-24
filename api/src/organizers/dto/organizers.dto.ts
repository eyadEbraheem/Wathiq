import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export const MAX_SPECIALTIES = 10;

export class SetSpecialtiesDto {
  @ApiProperty({
    example: ['تسرّب الأطفال من المدارس', 'العنف ضد النساء'],
    description: `Your specialties (max ${MAX_SPECIALTIES}). Replaces the whole list; [] clears it.`,
  })
  @IsArray()
  @ArrayMaxSize(MAX_SPECIALTIES)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim() : v))
      : value,
  )
  @IsString({ each: true })
  @MinLength(2, { each: true })
  @MaxLength(80, { each: true })
  names: string[];
}

export class FindSpecialtiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'تسرب',
    description: 'Text typed so far (matched after Arabic normalization).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

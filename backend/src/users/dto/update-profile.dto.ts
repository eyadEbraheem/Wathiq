import { ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel, Governorate, Locale } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

/** Every field is optional; only the fields sent are changed. `null` clears an enum field. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'سارة الأحمد' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiPropertyOptional({ example: 'متطوعة في حملات التشجير' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    enum: Governorate,
    nullable: true,
    example: Governorate.HAMA,
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsEnum(Governorate)
  governorate?: Governorate | null;

  @ApiPropertyOptional({ example: 'السلمية' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'الحي الشمالي' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @ApiPropertyOptional({
    enum: EducationLevel,
    nullable: true,
    example: EducationLevel.BACHELOR,
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({ example: 'هندسة مدنية' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  fieldOfStudy?: string;

  @ApiPropertyOptional({ example: 'تصميم جرافيك' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  workField?: string;

  @ApiPropertyOptional({ enum: Locale, example: Locale.ar })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

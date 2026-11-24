import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Locale } from '@prisma/client';
import {
  E164_REGEX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  Trim,
  TrimLower,
} from 'src/auth/dto/transforms';

/** Exactly one of `email` / `phone` is required (checked in the service). */
export class SignupDto {
  @ApiProperty({ example: 'سارة الأحمد' })
  @Trim()
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({
    example: '2004-05-17',
    description:
      'YYYY-MM-DD. A person must be 13+. For an organization this is its founding date (in the past).',
  })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthDate must be YYYY-MM-DD.' })
  birthDate: string;

  @ApiPropertyOptional({ example: 'sara@example.com' })
  @IsOptional()
  @TrimLower()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: '+963912345678',
    description: 'E.164. Not available until an SMS provider is set up.',
  })
  @IsOptional()
  @Trim()
  @Matches(E164_REGEX, { message: 'phone must be in E.164 format.' })
  phone?: string;

  @ApiProperty({ example: 'correct horse battery', minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Sign up as an organization: `name` is the organization, `birthDate` its founding date. ' +
      'The account can only browse until an admin approves its ORGANIZATION verification request.',
  })
  @IsOptional()
  @IsBoolean()
  organization?: boolean;

  @ApiPropertyOptional({ enum: Locale, example: Locale.ar })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}

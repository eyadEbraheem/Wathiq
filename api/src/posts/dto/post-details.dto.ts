import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel, OpportunityMode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { E164_REGEX, Trim } from 'src/auth/dto/transforms';

/** Humanitarian case details (humanitarian section only). No money passes through us. */
export class CaseDetailsDto {
  @ApiProperty({ example: '+963912345678' })
  @Trim()
  @Matches(E164_REGEX, { message: 'contactPhone must be in E.164 format.' })
  contactPhone: string;

  @ApiPropertyOptional({
    example: 'public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.png',
    description: 'Sham Cash QR image key from POST /uploads/images.',
  })
  @IsOptional()
  @IsString()
  paymentQrKey?: string;

  @ApiPropertyOptional({ example: 'التحويل باسم والد الطفلة عبر شام كاش.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  paymentNote?: string;
}

/** An external opportunity (education section only): applied for outside the platform. */
export class OpportunityDetailsDto {
  @ApiPropertyOptional({
    example: '2027-01-15T21:59:59.000Z',
    nullable: true,
    description: 'Last moment to apply (ISO 8601 UTC). null = no deadline.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @ApiProperty({ example: 'https://www.daad.de/en/' })
  @Trim()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  applyUrl: string;

  @ApiProperty({ enum: OpportunityMode, example: OpportunityMode.IN_PERSON })
  @IsEnum(OpportunityMode)
  mode: OpportunityMode;

  @ApiPropertyOptional({ example: 'برلين، ألمانيا' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ example: 'خرّيجو كليات الهندسة بمعدل 70% فما فوق.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  eligibility?: string;

  @ApiPropertyOptional({ example: 22, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  minAge?: number | null;

  @ApiPropertyOptional({ example: 35, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  maxAge?: number | null;

  @ApiPropertyOptional({
    enum: EducationLevel,
    nullable: true,
    example: EducationLevel.BACHELOR,
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({ example: 'هندسة' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  field?: string;
}

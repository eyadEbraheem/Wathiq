import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, VerifiedKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { E164_REGEX, Trim } from 'src/auth/dto/transforms';

export const ID_DOCUMENT_TYPES = [
  DocumentType.ID_CARD,
  DocumentType.PASSPORT,
] as const;

/**
 * Text fields of the multipart form. The files come separately:
 * `idDocument` (1, required) and `supporting` (up to 3, optional).
 */
export class CreateVerificationRequestDto {
  @ApiProperty({ enum: VerifiedKind, example: VerifiedKind.ORGANIZATION })
  @IsEnum(VerifiedKind)
  kind: VerifiedKind;

  @ApiProperty({ example: '+963912345678', description: 'E.164' })
  @Trim()
  @Matches(E164_REGEX, { message: 'contactPhone must be in E.164 format.' })
  contactPhone: string;

  @ApiPropertyOptional({
    example: '2019-04-01',
    description:
      'Founding date (YYYY-MM-DD). Required for ORGANIZATION, not allowed for INDIVIDUAL.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'foundedAt must be YYYY-MM-DD.' })
  foundedAt?: string;

  @ApiPropertyOptional({
    example: 'فريق تطوعي يعمل في السلمية منذ 2019 في حملات التشجير.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  details?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://facebook.com/our-team'],
    description: 'Previous work / references. Send the field once per link.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_protocol: true }, { each: true })
  links?: string[];

  @ApiProperty({ enum: ID_DOCUMENT_TYPES, example: DocumentType.ID_CARD })
  @IsIn(ID_DOCUMENT_TYPES)
  idDocumentType: (typeof ID_DOCUMENT_TYPES)[number];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export const MAX_EVENT_ROLES = 20;
export const MAX_EVENT_QUESTIONS = 10;
export const MAX_ROLE_CHOICES = 3;

/** A volunteer role with its own seats. */
export class EventRoleDto {
  @ApiPropertyOptional({
    example: 4,
    description:
      'Editing only: the id of an existing role to keep. Omit to add a new role.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({ example: 'تنظيم' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  seats: number;
}

/** A question the organizer asks every applicant. */
export class EventQuestionDto {
  @ApiProperty({ example: 'هل لديك خبرة سابقة في الإسعافات الأولية؟' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

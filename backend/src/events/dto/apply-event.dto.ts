import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import { MAX_ROLE_CHOICES } from 'src/events/dto/event-parts.dto';

export class ApplyEventDto {
  @ApiPropertyOptional({ example: 'متفرّغ يوم السبت كاملاً.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    example: { q1: 'نعم، دورة الهلال الأحمر 2025' },
    description:
      "Answers by question id (the event's `questions[].id`), each a string of up to 1000 characters.",
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: [4, 6],
    description: `Events with roles only: 1 to ${MAX_ROLE_CHOICES} role ids, first choice first.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ROLE_CHOICES)
  @ArrayUnique()
  @IsInt({ each: true })
  roleIds?: number[];
}

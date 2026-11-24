import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Governorate } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import {
  EventQuestionDto,
  EventRoleDto,
  MAX_EVENT_QUESTIONS,
  MAX_EVENT_ROLES,
} from 'src/events/dto/event-parts.dto';
import {
  MAX_POST_IMAGES,
  MAX_POST_TOPICS,
} from 'src/posts/dto/create-post.dto';

/** The event's dates. Shared by create, edit and clone. */
export class EventDatesDto {
  @ApiProperty({
    example: '2026-12-05T07:00:00.000Z',
    description: 'Start (ISO 8601 UTC). Must be in the future.',
  })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({
    example: '2026-12-05T12:00:00.000Z',
    nullable: true,
    description: 'End (after startsAt). null = no end time.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({
    example: '2026-12-03T21:59:59.000Z',
    nullable: true,
    description:
      'Last moment to apply (not after startsAt). null = until the event starts.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string | null;
}

export class CreateEventDto extends EventDatesDto {
  @ApiProperty({ example: 2, description: 'The section the event belongs to.' })
  @IsInt()
  @Min(1)
  sectionId: number;

  @ApiProperty({ example: 'حملة تشجير في حديقة تشرين' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({
    example: 'نزرع 300 شجرة مع أهالي الحي. القفازات والأدوات علينا.',
  })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    example: [7],
    description: `Topics of the same section (max ${MAX_POST_TOPICS}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_TOPICS)
  @ArrayUnique()
  @IsInt({ each: true })
  topicIds?: number[];

  @ApiPropertyOptional({
    example: ['public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.jpg'],
    description: `Image keys from POST /uploads/images, in display order (max ${MAX_POST_IMAGES}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  imageKeys?: string[];

  @ApiProperty({ enum: Governorate, example: Governorate.DAMASCUS })
  @IsEnum(Governorate)
  governorate: Governorate;

  @ApiProperty({ example: 'دمشق' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'حديقة تشرين، المدخل الشمالي' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  locationText?: string;

  @ApiPropertyOptional({ example: 33.5138, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional({ example: 36.2765, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({
    example: 16,
    nullable: true,
    description: "Minimum age on the event's start date. null = no limit.",
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(100)
  minAge?: number | null;

  @ApiProperty({
    example: 4,
    description:
      'Volunteer hours each accepted volunteer earns when the event is completed (1 to 500).',
  })
  @IsInt()
  @Min(1)
  @Max(500)
  volunteerHours: number;

  @ApiPropertyOptional({
    example: 20,
    nullable: true,
    description:
      'Accepted volunteers allowed. Not allowed together with roles (capacity is then the ' +
      'sum of the seats). null = unlimited.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  capacity?: number | null;

  @ApiPropertyOptional({
    type: [EventRoleDto],
    description: `Optional volunteer roles (max ${MAX_EVENT_ROLES}), names unique.`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVENT_ROLES)
  @ValidateNested({ each: true })
  @Type(() => EventRoleDto)
  roles?: EventRoleDto[];

  @ApiPropertyOptional({
    type: [EventQuestionDto],
    description: `Questions for applicants (max ${MAX_EVENT_QUESTIONS}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVENT_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => EventQuestionDto)
  questions?: EventQuestionDto[];
}

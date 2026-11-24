import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Attribution, PublishRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  MAX_POST_IMAGES,
  MAX_POST_TOPICS,
} from 'src/posts/dto/create-post.dto';
import { CaseDetailsDto } from 'src/posts/dto/post-details.dto';

export class CreatePublishRequestDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'The verified account asked to publish. Omit to ask the platform (admins).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetUserId?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  sectionId: number;

  @ApiProperty({ example: 'طفلة بحاجة لعملية قلب' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({ example: 'تحتاج سلمى (6 سنوات) لعملية قلب مفتوح خلال شهر.' })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    example: ['public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.jpg'],
    description: `Image keys from POST /uploads/images (max ${MAX_POST_IMAGES}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  imageKeys?: string[];

  @ApiPropertyOptional({
    enum: Attribution,
    description:
      'Platform requests only (required there): REQUESTER = under your name, ' +
      "PUBLISHER = under the platform's official account.",
  })
  @IsOptional()
  @IsEnum(Attribution)
  requestedAttribution?: Attribution;

  @ApiPropertyOptional({
    type: CaseDetailsDto,
    description:
      'Humanitarian section only: makes the request a humanitarian case (contact phone, QR, note).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseDetailsDto)
  caseDetails?: CaseDetailsDto;
}

export class ApprovePublishRequestDto {
  @ApiPropertyOptional({
    enum: Attribution,
    description:
      "Requests to an account only (required there): PUBLISHER = under the account's name, " +
      "REQUESTER = crediting the requester. Platform requests use the requester's choice.",
  })
  @IsOptional()
  @IsEnum(Attribution)
  attribution?: Attribution;

  @ApiPropertyOptional({
    example: [3],
    description: `Topics of the request's section for the new post (max ${MAX_POST_TOPICS}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_TOPICS)
  @ArrayUnique()
  @IsInt({ each: true })
  topicIds?: number[];
}

export class RejectPublishRequestDto {
  @ApiPropertyOptional({ example: 'المعلومات غير كافية للتحقق من الحالة.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class FindPublishRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PublishRequestStatus })
  @IsOptional()
  @IsEnum(PublishRequestStatus)
  status?: PublishRequestStatus;
}

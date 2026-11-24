import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventDatesDto } from 'src/events/dto/create-event.dto';
import { MAX_POST_IMAGES } from 'src/posts/dto/create-post.dto';

/**
 * New dates for the copy. Without `imageKeys` the source's images are copied (each into a new
 * file); with `imageKeys` those images are used instead.
 */
export class CloneEventDto extends EventDatesDto {
  @ApiPropertyOptional({
    example: ['public/0b7c6f7e-2a39-4b55-9a52-0d2b7f2b8c11.jpg'],
    description:
      "Image keys from POST /uploads/images for the new event. Omit to copy the source event's images.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_POST_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  imageKeys?: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, ValidateIf } from 'class-validator';

/** Set the profile photo from an uploaded image, or remove it with null. */
export class UpdateAvatarDto {
  @ApiProperty({
    example: 'public/3f0c2b1e-9a7d-4c3b-8e2f-1d5a6b7c8d9e.jpg',
    nullable: true,
    description:
      'The `key` returned by POST /uploads/images, or null to remove the photo.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^public\/[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    message: 'imageKey must be an uploaded image key.',
  })
  imageKey!: string | null;
}

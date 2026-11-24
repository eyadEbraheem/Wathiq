import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Show/hide switches for the public profile (also used when organizers review applicants). */
export class UpdatePrivacyDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Governorate, city, neighborhood',
  })
  @IsOptional()
  @IsBoolean()
  showAddress?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Age only, never the birth date',
  })
  @IsOptional()
  @IsBoolean()
  showAge?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Education level and field of study',
  })
  @IsOptional()
  @IsBoolean()
  showEducation?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  showWorkField?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Approved team memberships',
  })
  @IsOptional()
  @IsBoolean()
  showTeams?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      "Appear in verified accounts' people search (on by default; only visible fields can match)",
  })
  @IsOptional()
  @IsBoolean()
  showInSearch?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Verified accounts: hide your rating average (the public sees "rating hidden")',
  })
  @IsOptional()
  @IsBoolean()
  hideRating?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Verified accounts: accept publish requests from users (on by default)',
  })
  @IsOptional()
  @IsBoolean()
  acceptsPublishRequests?: boolean;
}

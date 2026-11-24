import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export const MIN_MEMBERSHIP_YEAR = 1950;

export class CreateTeamMembershipDto {
  @ApiProperty({ example: 7, description: 'The verified account of the team.' })
  @IsInt()
  @Min(1)
  teamId: number;

  @ApiPropertyOptional({ example: 'منسّقة ميدانية' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  role?: string;

  @ApiPropertyOptional({ example: 'تنظيم حملات التشجير في الريف الشرقي.' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 2021, nullable: true })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(MIN_MEMBERSHIP_YEAR)
  @Max(2100)
  startYear?: number | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'null = still a member.',
  })
  @ValidateIf((_o, value) => value !== null)
  @IsOptional()
  @IsInt()
  @Min(MIN_MEMBERSHIP_YEAR)
  @Max(2100)
  endYear?: number | null;
}

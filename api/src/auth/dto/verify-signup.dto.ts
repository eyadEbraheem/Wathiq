import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export class SignupIdDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  signupId: number;
}

export class VerifySignupDto extends SignupIdDto {
  @ApiProperty({ example: '483920' })
  @Trim()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits.' })
  code: string;

  @ApiPropertyOptional({ example: 'iPhone 15 / iOS 19' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

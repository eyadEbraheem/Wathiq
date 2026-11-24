import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN, Trim } from 'src/auth/dto/transforms';

export class ChangePasswordDto {
  @ApiProperty({ example: 'correct horse battery' })
  @IsString()
  @Length(1, PASSWORD_MAX)
  currentPassword: string;

  @ApiProperty({ example: 'a new long password', minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword: string;

  @ApiPropertyOptional({
    example: 'web',
    description: 'Label for the new session of this device.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

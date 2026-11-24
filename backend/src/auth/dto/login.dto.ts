import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export class LoginDto {
  @ApiProperty({
    example: 'sara@example.com',
    description: 'Email address or E.164 phone number.',
  })
  @Trim()
  @IsString()
  @Length(3, 254)
  identifier: string;

  @ApiProperty({ example: 'correct horse battery' })
  @IsString()
  @MaxLength(200)
  password: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

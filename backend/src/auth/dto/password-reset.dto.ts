import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN, Trim } from 'src/auth/dto/transforms';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'sara@example.com',
    description: 'Email address or E.164 phone number.',
  })
  @Trim()
  @IsString()
  @Length(3, 254)
  identifier: string;
}

export class ResetPasswordDto extends ForgotPasswordDto {
  @ApiProperty({ example: '483920' })
  @Trim()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits.' })
  code: string;

  @ApiProperty({ example: 'a new long password', minLength: PASSWORD_MIN })
  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  newPassword: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'q2Jx...base64url' })
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

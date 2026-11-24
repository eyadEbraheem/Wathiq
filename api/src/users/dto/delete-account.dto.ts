import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'correct horse battery',
    description: 'Current password.',
  })
  @IsString()
  @MaxLength(200)
  password: string;
}

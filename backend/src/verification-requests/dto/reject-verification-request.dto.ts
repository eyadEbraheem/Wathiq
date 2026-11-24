import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

export class RejectVerificationRequestDto {
  @ApiProperty({
    example: 'صورة الهوية غير واضحة، يرجى إعادة الإرسال.',
    description: 'Shown to the user.',
  })
  @Trim()
  @IsString()
  @Length(3, 500)
  reason: string;
}

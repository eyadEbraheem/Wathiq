import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class RateEventDto {
  @ApiProperty({
    example: 12,
    description: 'Your ACCEPTED application to a COMPLETED event.',
  })
  @IsInt()
  @Min(1)
  applicationId: number;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;
}

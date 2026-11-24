import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from 'src/auth/dto/transforms';

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]). */
export const EXPO_TOKEN_REGEX = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;

export class RegisterPushDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'From Notifications.getExpoPushTokenAsync() on the phone.',
  })
  @Trim()
  @IsString()
  @MaxLength(250)
  @Matches(EXPO_TOKEN_REGEX, {
    message: 'pushToken must be an Expo push token.',
  })
  pushToken: string;

  @ApiProperty({ enum: DevicePlatform, example: DevicePlatform.ANDROID })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

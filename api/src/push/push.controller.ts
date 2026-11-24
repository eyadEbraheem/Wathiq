import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AllowWhilePending } from 'src/common/decorators/allow-while-pending.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { RegisterPushDeviceDto } from 'src/push/dto/push-device.dto';
import { PushService } from 'src/push/push.service';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AllowWhilePending()
@Controller('push-devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Register this phone's Expo push token for your account (call after login and on app start)",
  })
  @ApiResponse({ status: 200, description: '{ id, platform, lastSeenAt }' })
  @ApiResponse({ status: 400, description: 'Not an Expo push token.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterPushDeviceDto) {
    return this.push.register(user.id, dto.pushToken, dto.platform);
  }

  @Delete(':pushToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Stop push notifications on this phone (call on logout; URL-encode the token)',
  })
  @ApiParam({ name: 'pushToken', example: 'ExponentPushToken[xxxx]' })
  @ApiResponse({ status: 204, description: 'Removed (or was not registered).' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  unregister(
    @CurrentUser() user: AuthUser,
    @Param('pushToken') pushToken: string,
  ): Promise<void> {
    return this.push.unregister(user.id, pushToken);
  }
}

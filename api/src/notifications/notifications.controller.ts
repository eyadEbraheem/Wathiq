import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AllowWhilePending } from 'src/common/decorators/allow-while-pending.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { FindNotificationsQueryDto } from 'src/notifications/dto/find-notifications-query.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@AllowWhilePending()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Your notifications, newest first' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 400, description: 'Invalid query.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: FindNotificationsQueryDto,
  ) {
    return this.notifications.findMine(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'How many notifications are unread (for the badge)',
  })
  @ApiResponse({ status: 200, description: '{ count }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiResponse({ status: 204, description: 'Marked as read.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such notification of yours.' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all your notifications as read' })
  @ApiResponse({ status: 200, description: '{ updated }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }
}

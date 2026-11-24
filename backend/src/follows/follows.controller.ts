import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { FollowsService } from 'src/follows/follows.service';

@ApiTags('follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Get('me/following')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accounts you follow' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  following(@CurrentUser() me: AuthUser, @Query() query: PaginationQueryDto) {
    return this.follows.following(me.id, query);
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Follow a verified account' })
  @ApiResponse({ status: 204, description: 'Now following.' })
  @ApiResponse({
    status: 400,
    description: 'Not a verified account, or yourself.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  @ApiResponse({ status: 409, description: 'Already following.' })
  async follow(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.follows.follow(me.id, id);
  }

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfollow an account' })
  @ApiResponse({ status: 204, description: 'Unfollowed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 404, description: 'You do not follow this account.' })
  async unfollow(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.follows.unfollow(me.id, id);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: "An account's followers (public)" })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 404, description: 'No such user.' })
  followers(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.follows.followers(id, query);
  }
}

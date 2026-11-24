import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { DeleteAccountDto } from 'src/users/dto/delete-account.dto';
import {
  SetInterestsDto,
  SetPrimarySectionDto,
} from 'src/users/dto/interests.dto';
import { UpdatePrivacyDto } from 'src/users/dto/update-privacy.dto';
import { UpdateAvatarDto } from 'src/users/dto/update-avatar.dto';
import { UpdateProfileDto } from 'src/users/dto/update-profile.dto';
import { UsersService } from 'src/users/users.service';

@ApiTags('users')
@AllowWhilePending()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // ── Own account (/users/me/...) ───────────────────────────────────────────

  @Patch('me/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update your profile fields (only the fields sent change)',
  })
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  updateProfile(@CurrentUser() me: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(me.id, dto);
  }

  @Patch('me/avatar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Set your profile photo from an uploaded image key, or remove it with null',
  })
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiResponse({ status: 400, description: 'Not an uploaded image.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'The account is suspended.' })
  updateAvatar(@CurrentUser() me: AuthUser, @Body() dto: UpdateAvatarDto) {
    return this.users.updateAvatar(me.id, dto.imageKey);
  }

  @Patch('me/privacy')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update profile visibility switches' })
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  updatePrivacy(@CurrentUser() me: AuthUser, @Body() dto: UpdatePrivacyDto) {
    return this.users.updatePrivacy(me.id, dto);
  }

  @Get('me/interests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Your section and topic interests and primary section',
  })
  @ApiResponse({
    status: 200,
    description: '{ sectionIds, topicIds, primarySectionId }',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  getInterests(@CurrentUser() me: AuthUser) {
    return this.users.getInterests(me.id);
  }

  @Put('me/interests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Replace your section and topic interests' })
  @ApiResponse({ status: 200, description: 'The saved interests.' })
  @ApiResponse({
    status: 400,
    description:
      'Unknown section/topic, topic outside the chosen sections, or bad primary.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  setInterests(@CurrentUser() me: AuthUser, @Body() dto: SetInterestsDto) {
    return this.users.setInterests(me.id, dto);
  }

  @Patch('me/primary-section')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change your home section' })
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiResponse({
    status: 400,
    description: 'Not one of your section interests.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  setPrimarySection(
    @CurrentUser() me: AuthUser,
    @Body() dto: SetPrimarySectionDto,
  ) {
    return this.users.setPrimarySection(me.id, dto.sectionId);
  }

  @Post('me/onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Finish the onboarding wizard (interests required)',
  })
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiResponse({ status: 400, description: 'No interests chosen yet.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  completeOnboarding(@CurrentUser() me: AuthUser) {
    return this.users.completeOnboarding(me.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Delete your account (anonymized; your content stays as "deleted account")',
  })
  @ApiResponse({
    status: 204,
    description: 'Account deleted and signed out everywhere.',
  })
  @ApiResponse({
    status: 400,
    description: 'Incorrect password or official account.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  async deleteAccount(
    @CurrentUser() me: AuthUser,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.users.deleteAccount(me.id, dto);
  }

  // ── Public ────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: "A user's public profile (respects their visibility settings)",
  })
  @ApiResponse({ status: 200, description: 'The public profile.' })
  @ApiResponse({ status: 400, description: 'id is not a number.' })
  @ApiResponse({
    status: 404,
    description: 'No such user, or the account was deleted.',
  })
  getPublicProfile(@Param('id', ParseIntPipe) id: number) {
    return this.users.getPublicProfile(id);
  }
}

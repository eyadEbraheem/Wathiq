import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AllowWhilePending } from 'src/common/decorators/allow-while-pending.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import type { SafeUser } from 'src/users/safe-user';
import {
  AuthService,
  type AuthResponse,
  type PendingSignupResponse,
} from 'src/auth/auth.service';
import { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import { LoginDto } from 'src/auth/dto/login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from 'src/auth/dto/password-reset.dto';
import { RefreshTokenDto } from 'src/auth/dto/refresh-token.dto';
import { SignupDto } from 'src/auth/dto/signup.dto';
import { SignupIdDto, VerifySignupDto } from 'src/auth/dto/verify-signup.dto';
import type { AuthTokens } from 'src/auth/tokens.service';

/** Stricter per-IP limit for endpoints that send codes or check passwords. */
const SENSITIVE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Start sign-up: stores the data and sends a 6-digit code',
    description:
      'No account exists until the code is confirmed with POST /auth/signup/verify.',
  })
  @ApiResponse({ status: 201, description: 'Code sent.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data, under 13, or phone not available.',
  })
  @ApiResponse({
    status: 409,
    description: 'An account with this contact already exists.',
  })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  signup(@Body() dto: SignupDto): Promise<PendingSignupResponse> {
    return this.auth.signup(dto);
  }

  @Post('signup/resend')
  @Throttle(SENSITIVE)
  @ApiOperation({ summary: 'Send a new sign-up code' })
  @ApiResponse({ status: 201, description: 'New code sent.' })
  @ApiResponse({ status: 400, description: 'Unknown or expired sign-up.' })
  @ApiResponse({ status: 429, description: 'Resend cooldown not over yet.' })
  resendSignupCode(@Body() dto: SignupIdDto): Promise<PendingSignupResponse> {
    return this.auth.resendSignupCode(dto.signupId);
  }

  @Post('signup/verify')
  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Confirm the sign-up code: creates the account and signs in',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created; returns user and tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Wrong, expired or over-used code.',
  })
  @ApiResponse({ status: 409, description: 'Contact taken in the meantime.' })
  verifySignup(@Body() dto: VerifySignupDto): Promise<AuthResponse> {
    return this.auth.verifySignup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(SENSITIVE)
  @ApiOperation({ summary: 'Log in with email or phone and password' })
  @ApiResponse({ status: 200, description: 'Returns user and tokens.' })
  @ApiResponse({ status: 400, description: 'Invalid body.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many attempts.' })
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exchange a refresh token for a new token pair (the old one is revoked)',
  })
  @ApiResponse({ status: 200, description: 'New tokens.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired or reused refresh token.',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({ status: 204, description: 'Revoked (or already invalid).' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiResponse({ status: 200, description: 'The current user.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  me(@CurrentUser() user: AuthUser): Promise<SafeUser> {
    return this.auth.me(user.id);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Send a password reset code',
    description: 'Always returns 202, whether or not the account exists.',
  })
  @ApiResponse({
    status: 202,
    description: 'If the account exists, a code was sent.',
  })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.auth.forgotPassword(dto);
    return { message: 'If an account exists, a reset code has been sent.' };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Set a new password with the reset code; signs out all devices',
  })
  @ApiResponse({ status: 204, description: 'Password changed.' })
  @ApiResponse({
    status: 400,
    description: 'Wrong, expired or over-used code.',
  })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto);
  }

  @Post('password/change')
  @AllowWhilePending()
  @HttpCode(HttpStatus.OK)
  @Throttle(SENSITIVE)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Change the password with the current one; other devices are signed out',
    description:
      'Returns a new token pair for this device (the old refresh token is revoked).',
  })
  @ApiResponse({ status: 200, description: 'Password changed; new tokens.' })
  @ApiResponse({
    status: 400,
    description: 'Wrong current password, or the new one is the same.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<AuthTokens> {
    return this.auth.changePassword(user.id, dto);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  Locale,
  OtpChannel,
  OtpPurpose,
  Prisma,
  type User,
} from '@prisma/client';
import { ageOn } from 'src/common/utils/age';
import { TooManyRequestsException } from 'src/common/utils/too-many-requests.exception';
import { normalizeArabic } from 'src/common/utils/arabic';
import { PrismaService } from 'src/prisma/prisma.service';
import { toSafeUser, type SafeUser } from 'src/users/safe-user';
import type {
  ForgotPasswordDto,
  ResetPasswordDto,
} from 'src/auth/dto/password-reset.dto';
import type { ChangePasswordDto } from 'src/auth/dto/change-password.dto';
import type { LoginDto } from 'src/auth/dto/login.dto';
import type { SignupDto } from 'src/auth/dto/signup.dto';
import type { VerifySignupDto } from 'src/auth/dto/verify-signup.dto';
import { OtpSender } from 'src/auth/otp/otp-sender';
import { OtpService } from 'src/auth/otp/otp.service';
import { E164_REGEX } from 'src/auth/dto/transforms';
import { AuthTokens, TokensService } from 'src/auth/tokens.service';

const BCRYPT_ROUNDS = 10;
const MIN_AGE = 13;
/** Max sign-up attempts for one contact per hour (each one sends a code). */
const MAX_SIGNUPS_PER_CONTACT_PER_HOUR = 5;
const INVALID_LOGIN = 'Invalid email or password.';
const INVALID_CODE = 'Invalid or expired code.';
// Compared against when the user does not exist, so both paths take the same time.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

export interface PendingSignupResponse {
  signupId: number;
  channel: OtpChannel;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

type Contact =
  | { channel: typeof OtpChannel.EMAIL; email: string; phone?: undefined }
  | { channel: typeof OtpChannel.SMS; phone: string; email?: undefined };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly otpSender: OtpSender,
    private readonly tokens: TokensService,
  ) {}

  // ── Sign-up ───────────────────────────────────────────────────────────────

  /** Stores the sign-up in PendingSignup and sends a code. No User row is created yet. */
  async signup(dto: SignupDto): Promise<PendingSignupResponse> {
    const contact = this.contactFromSignup(dto);
    const birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);
    const organization = dto.organization === true;
    // For an organization birthDate is its founding date: no age rule, but not in the future.
    if (organization && birthDate > new Date()) {
      throw new BadRequestException(
        'The founding date cannot be in the future.',
      );
    }
    if (!organization && ageOn(birthDate) < MIN_AGE) {
      throw new BadRequestException(
        `You must be at least ${MIN_AGE} years old to sign up.`,
      );
    }

    await this.assertContactFree(contact);

    const recent = await this.prisma.pendingSignup.count({
      where: {
        ...this.contactWhere(contact),
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recent >= MAX_SIGNUPS_PER_CONTACT_PER_HOUR) {
      throw new TooManyRequestsException(
        'Too many sign-up attempts for this contact. Try again later.',
      );
    }

    const code = this.otp.generateCode();
    const locale = dto.locale ?? Locale.ar;
    const pending = await this.prisma.pendingSignup.create({
      data: {
        name: dto.name,
        birthDate,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        organization,
        locale,
        channel: contact.channel,
        codeHash: this.otp.hash(code),
        expiresAt: this.otp.expiresAt(),
      },
    });

    try {
      await this.sendCode(contact, code, 'SIGNUP', locale);
    } catch (error) {
      // Nothing was sent: drop the row so the user can simply try again.
      await this.prisma.pendingSignup.delete({ where: { id: pending.id } });
      throw error;
    }
    this.logger.log(`Pending sign-up ${pending.id} created.`);
    return this.pendingResponse(pending);
  }

  async resendSignupCode(signupId: number): Promise<PendingSignupResponse> {
    const pending = await this.prisma.pendingSignup.findUnique({
      where: { id: signupId },
    });
    if (!pending) {
      throw new BadRequestException(
        'This sign-up has expired. Please sign up again.',
      );
    }
    if (new Date() < this.otp.resendAvailableAt(pending.expiresAt)) {
      throw new TooManyRequestsException(
        'Please wait before requesting a new code.',
      );
    }

    // Send first: if delivery fails, the old code stays valid and no cooldown starts.
    const code = this.otp.generateCode();
    await this.sendCode(
      this.contactFromPending(pending),
      code,
      'SIGNUP',
      pending.locale,
    );
    const updated = await this.prisma.pendingSignup.update({
      where: { id: pending.id },
      data: {
        codeHash: this.otp.hash(code),
        attempts: 0,
        expiresAt: this.otp.expiresAt(),
      },
    });
    return this.pendingResponse(updated);
  }

  /** Confirms the code, creates the User with the contact already verified, signs in. */
  async verifySignup(dto: VerifySignupDto): Promise<AuthResponse> {
    const pending = await this.prisma.pendingSignup.findUnique({
      where: { id: dto.signupId },
    });
    if (!pending || pending.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_CODE);
    }
    if (pending.attempts >= this.otp.maxAttempts) {
      throw new BadRequestException(
        'Too many incorrect attempts. Request a new code.',
      );
    }
    if (!this.otp.matches(dto.code, pending.codeHash)) {
      await this.prisma.pendingSignup.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(INVALID_CODE);
    }

    const contact = this.contactFromPending(pending);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await this.assertContactFree(contact, tx);
        const now = new Date();
        const user = await tx.user.create({
          data: {
            name: pending.name,
            searchName: normalizeArabic(pending.name),
            birthDate: pending.birthDate,
            email: pending.email,
            phone: pending.phone,
            emailVerifiedAt: pending.email ? now : null,
            phoneVerifiedAt: pending.phone ? now : null,
            passwordHash: pending.passwordHash,
            locale: pending.locale,
            // Frozen (browse only) until its verification request is approved.
            pendingOrganization: pending.organization,
          },
        });
        // Every other pending sign-up for this contact is now pointless.
        await tx.pendingSignup.deleteMany({
          where: this.contactWhere(contact),
        });
        const tokens = await this.tokens.issue(user, dto.deviceInfo, tx);
        return { user, tokens };
      });
      this.logger.log(
        `User ${result.user.id} created from sign-up ${pending.id}.`,
      );
      return { user: toSafeUser(result.user), tokens: result.tokens };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(this.contactTakenMessage(contact));
      }
      throw error;
    }
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    const hash = user?.passwordHash || DUMMY_HASH;
    const passwordOk = await bcrypt.compare(dto.password, hash);
    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    const tokens = await this.tokens.issue(user, dto.deviceInfo);
    this.logger.log(`User ${user.id} logged in.`);
    return { user: toSafeUser(user), tokens };
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  async me(userId: number): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    return toSafeUser(user);
  }

  // ── Password reset ────────────────────────────────────────────────────────

  /**
   * Always succeeds from the caller's point of view, so it cannot be used to find out which
   * emails / phones have accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) return;

    const contact = this.contactForUser(user, dto.identifier);
    if (contact.channel === OtpChannel.SMS && !this.otp.smsEnabled) return;

    const latest = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, purpose: OtpPurpose.PASSWORD_RESET },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && new Date() < this.otp.resendAvailableAt(latest.expiresAt)) {
      return;
    }

    const code = this.otp.generateCode();
    const otpRow = await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        channel: contact.channel,
        purpose: OtpPurpose.PASSWORD_RESET,
        target: this.target(contact),
        codeHash: this.otp.hash(code),
        expiresAt: this.otp.expiresAt(),
      },
    });
    try {
      await this.sendCode(contact, code, 'PASSWORD_RESET', user.locale);
    } catch (error) {
      // Still answer 202 like for unknown accounts, so failures cannot reveal who exists.
      await this.prisma.otpCode.delete({ where: { id: otpRow.id } });
      this.logger.error(
        `Password reset code for user ${user.id} could not be sent: ${String(error)}`,
      );
      return;
    }
    this.logger.log(`Password reset code sent to user ${user.id}.`);
  }

  /** Sets the new password and signs the user out everywhere. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.findActiveUserByIdentifier(dto.identifier);
    if (!user) throw new BadRequestException(INVALID_CODE);

    const target = this.contactForUser(user, dto.identifier);
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose: OtpPurpose.PASSWORD_RESET,
        target: this.target(target),
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_CODE);
    }
    if (otp.attempts >= this.otp.maxAttempts) {
      throw new BadRequestException(
        'Too many incorrect attempts. Request a new code.',
      );
    }
    if (!this.otp.matches(dto.code, otp.codeHash)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException(INVALID_CODE);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await this.tokens.revokeAllForUser(user.id, tx);
    });
    this.logger.log(`Password reset for user ${user.id}.`);
  }

  /**
   * A signed-in user changes their password with the current one. Every other device is signed
   * out; this device gets a fresh token pair so it stays signed in.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    // 400, not 401: a wrong current password must not look like an expired session.
    const currentOk =
      Boolean(user.passwordHash) &&
      (await bcrypt.compare(dto.currentPassword, user.passwordHash));
    if (!currentOk) {
      throw new BadRequestException('Current password is incorrect.');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'The new password must be different from the current one.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    const tokens = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      // Deleted, not revoked: another device refreshing with its old token must not end
      // the session issued below.
      await this.tokens.deleteAllForUser(user.id, tx);
      return this.tokens.issue(user, dto.deviceInfo, tx);
    });
    this.logger.log(`Password changed for user ${user.id}.`);
    return tokens;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private contactFromSignup(dto: SignupDto): Contact {
    if (dto.email && dto.phone) {
      throw new BadRequestException(
        'Sign up with an email address or a phone number, not both.',
      );
    }
    if (dto.email) return { channel: OtpChannel.EMAIL, email: dto.email };
    if (dto.phone) {
      if (!this.otp.smsEnabled) {
        throw new BadRequestException(
          'Sign-up with a phone number is not available yet. Please use an email address.',
        );
      }
      return { channel: OtpChannel.SMS, phone: dto.phone };
    }
    throw new BadRequestException(
      'An email address or a phone number is required.',
    );
  }

  private contactFromPending(pending: {
    email: string | null;
    phone: string | null;
  }): Contact {
    if (pending.email)
      return { channel: OtpChannel.EMAIL, email: pending.email };
    if (pending.phone) return { channel: OtpChannel.SMS, phone: pending.phone };
    throw new Error('Pending sign-up has no contact.');
  }

  /** The contact matching what the user typed (email or phone). */
  private contactForUser(user: User, identifier: string): Contact {
    if (this.isEmail(identifier) && user.email) {
      return { channel: OtpChannel.EMAIL, email: user.email };
    }
    if (user.phone) return { channel: OtpChannel.SMS, phone: user.phone };
    return { channel: OtpChannel.EMAIL, email: user.email ?? '' };
  }

  private contactWhere(contact: Contact): Prisma.PendingSignupWhereInput {
    return contact.email ? { email: contact.email } : { phone: contact.phone };
  }

  private async assertContactFree(
    contact: Contact,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const taken = await db.user.findFirst({
      where: contact.email
        ? { email: contact.email }
        : { phone: contact.phone },
      select: { id: true },
    });
    if (taken) throw new ConflictException(this.contactTakenMessage(contact));
  }

  private target(contact: Contact): string {
    return contact.channel === OtpChannel.EMAIL ? contact.email : contact.phone;
  }

  private contactTakenMessage(contact: Contact): string {
    return contact.email
      ? 'An account with this email already exists.'
      : 'An account with this phone number already exists.';
  }

  private isEmail(identifier: string): boolean {
    return identifier.includes('@');
  }

  private findActiveUserByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    if (this.isEmail(value)) {
      return this.prisma.user.findFirst({
        where: { email: value.toLowerCase(), deletedAt: null },
      });
    }
    if (!E164_REGEX.test(value)) return Promise.resolve(null);
    return this.prisma.user.findFirst({
      where: { phone: value, deletedAt: null },
    });
  }

  private async sendCode(
    contact: Contact,
    code: string,
    reason: 'SIGNUP' | 'PASSWORD_RESET',
    locale: Locale,
  ): Promise<void> {
    await this.otpSender.send({
      channel: contact.channel,
      target: this.target(contact),
      code,
      reason,
      locale,
      expiresInMinutes: this.otp.ttlMinutes,
    });
  }

  private pendingResponse(pending: {
    id: number;
    channel: OtpChannel;
    expiresAt: Date;
  }): PendingSignupResponse {
    return {
      signupId: pending.id,
      channel: pending.channel,
      expiresAt: pending.expiresAt,
      resendAvailableAt: this.otp.resendAvailableAt(pending.expiresAt),
    };
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from 'src/common/types/auth-user';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Access tokens are short-lived JWTs. Refresh tokens are random strings stored as SHA-256
 * hashes, rotated on every refresh. Presenting an already-rotated refresh token is treated as
 * theft: every session of that user is revoked.
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = Number(config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    this.refreshTtlDays = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
  }

  async issue(
    user: { id: number; email: string | null },
    deviceInfo = '',
    db: Db = this.prisma,
  ): Promise<AuthTokens> {
    const now = Date.now();
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenExpiresAt = new Date(
      now + this.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        deviceInfo: deviceInfo.slice(0, 255),
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      accessTokenExpiresAt: new Date(now + this.accessTtlSeconds * 1000),
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  /** Revokes the presented refresh token and returns a new pair. */
  async rotate(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(refreshToken) },
      include: { user: { select: { id: true, email: true, deletedAt: true } } },
    });
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      this.logger.warn(
        `Rotated refresh token reused for user ${stored.userId}; all sessions revoked.`,
      );
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (stored.expiresAt <= new Date() || stored.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional update so two concurrent refreshes cannot both succeed.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        throw new UnauthorizedException('Invalid refresh token.');
      }
      return this.issue(stored.user, stored.deviceInfo, tx);
    });
  }

  /** Logout. Unknown or already revoked tokens are ignored. */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: number, db: Db = this.prisma): Promise<void> {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Removes every refresh token of the user. Unlike revoking, an old token used later is simply
   * unknown, so it does not trigger the reuse check that would also end the new session.
   */
  async deleteAllForUser(userId: number, db: Db = this.prisma): Promise<void> {
    await db.refreshToken.deleteMany({ where: { userId } });
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

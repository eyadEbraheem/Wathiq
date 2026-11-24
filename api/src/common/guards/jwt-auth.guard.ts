import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ALLOW_WHILE_PENDING_KEY } from 'src/common/decorators/allow-while-pending.decorator';
import type { AccessTokenPayload } from 'src/common/types/auth-user';
import { PrismaService } from 'src/prisma/prisma.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Reads `Authorization: Bearer <access token>` and sets `request.user`.
 *
 * Also keeps an organization that signed up but is not verified yet read-only: on a write
 * route without `@AllowWhilePending()`, it gets 403. The flag is read from the database, so the
 * approval applies at once.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    request.user = { id: payload.sub, email: payload.email };

    if (READ_METHODS.has(request.method)) return true;
    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_WHILE_PENDING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { pendingOrganization: true },
    });
    if (user?.pendingOrganization) {
      throw new ForbiddenException(
        'Your organization account is waiting for verification. Until an admin approves it, you can only browse and edit your own account.',
      );
    }
    return true;
  }
}

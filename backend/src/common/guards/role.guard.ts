import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { REQUIRED_ROLES_KEY } from 'src/common/decorators/require-role.decorator';

/**
 * Checks `@RequireRole([...])`. Runs after JwtAuthGuard. The role is read from the database,
 * not the token, so a role change applies immediately.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Missing access token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to do this.');
    }
    return true;
  }
}

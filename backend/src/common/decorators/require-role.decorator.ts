import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/** Restricts a route to the given roles. Use together with JwtAuthGuard and RoleGuard. */
export const RequireRole = (roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

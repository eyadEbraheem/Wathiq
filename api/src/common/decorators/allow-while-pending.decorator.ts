import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHILE_PENDING_KEY = 'allowWhilePending';

/**
 * Lets an organization that is still waiting for verification (`pendingOrganization`) use a
 * write route. Everything else it can only read (GET); JwtAuthGuard refuses the rest with 403.
 * Put it on its own settings, its verification request and its notifications.
 */
export const AllowWhilePending = () =>
  SetMetadata(ALLOW_WHILE_PENDING_KEY, true);

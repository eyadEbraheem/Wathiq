import type { CurrentUser } from '@csh/shared';

type AccountKind = Pick<CurrentUser, 'verifiedKind' | 'pendingOrganization'>;

/** Organizations organize activities; they are not volunteer accounts. */
export function isOrganization(user: AccountKind): boolean {
  return (
    user.verifiedKind === 'ORGANIZATION' || user.pendingOrganization === true
  );
}

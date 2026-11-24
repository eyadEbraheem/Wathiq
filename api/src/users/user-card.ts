import type { Prisma } from '@prisma/client';

/** The few public fields shown wherever a user appears in a list (followers, members, ...). */
export const USER_CARD_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  verifiedKind: true,
  isPartner: true,
  isOfficial: true,
} satisfies Prisma.UserSelect;

export type UserCard = Prisma.UserGetPayload<{
  select: typeof USER_CARD_SELECT;
}>;

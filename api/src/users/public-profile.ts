import type {
  EducationLevel,
  Governorate,
  User,
  VerifiedKind,
} from '@prisma/client';
import { ageOn } from 'src/common/utils/age';

const ADULT_AGE = 18;

/**
 * What other people see of a user: the public profile, and event organizers reviewing
 * applicants. Hidden groups are `null`. For users under 18 every optional group is hidden,
 * whatever their switches say. The birth date itself is never exposed.
 */
export interface PublicProfile {
  id: number;
  name: string;
  avatarUrl: string;
  bio: string;
  verifiedKind: VerifiedKind | null;
  isPartner: boolean;
  isOfficial: boolean;
  createdAt: Date;
  address: {
    governorate: Governorate | null;
    city: string;
    neighborhood: string;
  } | null;
  age: number | null;
  /** Organizations only: the year from their founding date. */
  foundedYear: number | null;
  education: { level: EducationLevel | null; fieldOfStudy: string } | null;
  workField: string | null;
}

export function toPublicProfile(
  user: User,
  now: Date = new Date(),
): PublicProfile {
  // For organizations birthDate is the founding date: no age, no under-18 rule.
  const isOrganization = user.verifiedKind === 'ORGANIZATION';
  const age = ageOn(user.birthDate, now);
  const adult = isOrganization || age >= ADULT_AGE;
  const showAge = !isOrganization && adult && user.showAge;

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    verifiedKind: user.verifiedKind,
    isPartner: user.isPartner,
    isOfficial: user.isOfficial,
    createdAt: user.createdAt,
    address:
      adult && user.showAddress
        ? {
            governorate: user.governorate,
            city: user.city,
            neighborhood: user.neighborhood,
          }
        : null,
    age: showAge ? age : null,
    foundedYear: isOrganization ? user.birthDate.getUTCFullYear() : null,
    education:
      adult && user.showEducation
        ? { level: user.educationLevel, fieldOfStudy: user.fieldOfStudy }
        : null,
    workField: adult && user.showWorkField ? user.workField : null,
  };
}

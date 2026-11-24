import type { CurrentUser } from "@/lib/types";

type AccountKind = Pick<CurrentUser, "verifiedKind"> & Partial<Pick<CurrentUser, "pendingOrganization">>;

/**
 * An organization account is not a person: it does not volunteer, earn badges or join teams,
 * and personal fields (age, education, work) do not apply to it. A verified individual is
 * still a person. An organization that signed up and waits for verification counts too.
 */
export function isOrganization(user: AccountKind | null | undefined): boolean {
  return user?.verifiedKind === "ORGANIZATION" || user?.pendingOrganization === true;
}

/**
 * Signed up as an organization and not approved yet: it can only browse, edit its own account
 * and send its verification request (the API refuses everything else).
 */
export function isFrozen(user: Partial<Pick<CurrentUser, "pendingOrganization">> | null | undefined): boolean {
  return user?.pendingOrganization === true;
}

// API response types used by the web. Dates from the API are ISO strings.
import type {
  EducationLevel,
  Governorate,
  Locale,
  MembershipStatus,
  UserRole,
  VerifiedKind,
} from "@csh/shared";

export type { ApiError, Paginated, WeeklyHighlight } from "@csh/shared";
import type { Paginated as PaginatedOf } from "@csh/shared";

/** The signed-in user as returned by GET /auth/me (never contains the password hash). */
export interface CurrentUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  locale: Locale;
  avatarUrl: string;
  bio: string;
  birthDate: string;
  governorate: Governorate | null;
  city: string;
  neighborhood: string;
  educationLevel: EducationLevel | null;
  fieldOfStudy: string;
  workField: string;
  onboardingCompletedAt: string | null;
  primarySectionId: number | null;
  showAddress: boolean;
  showAge: boolean;
  showEducation: boolean;
  showWorkField: boolean;
  showTeams: boolean;
  showInSearch: boolean;
  hideRating: boolean;
  acceptsPublishRequests: boolean;
  verifiedKind: VerifiedKind | null;
  /** Signed up as an organization and waiting for verification: browse only until approved. */
  pendingOrganization: boolean;
  isPartner: boolean;
  isOfficial: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface Topic {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface Section {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  topics: Topic[];
}

export interface Interests {
  sectionIds: number[];
  topicIds: number[];
  primarySectionId: number | null;
}

/** A user as shown on cards and lists (USER_CARD_SELECT in the API). */
export interface UserCard {
  id: number;
  name: string;
  avatarUrl: string;
  verifiedKind: VerifiedKind | null;
  isPartner: boolean;
  isOfficial: boolean;
}

export interface PostMedia {
  id: number;
  url: string;
  mimeType: string;
}

/** The event block of a post card (GET /posts, GET /events). */
export interface EventSummary {
  status: "OPEN" | "CLOSED" | "COMPLETED" | "CANCELLED";
  startsAt: string;
  endsAt: string | null;
  applicationDeadline: string | null;
  capacity: number | null;
  /** Hours each accepted volunteer earns once the event is completed. */
  volunteerHours: number;
  governorate: Governorate;
  city: string;
  locationText: string;
  minAge: number | null;
  acceptedCount: number;
  seatsLeft: number | null;
}

/** A post or event as the feed returns it. */
export interface PostView {
  id: number;
  kind: "POST" | "EVENT";
  status: "PUBLISHED" | "HIDDEN" | "DELETED";
  title: string;
  body: string;
  upvoteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  section: { id: number; slug: string; nameAr: string; nameEn: string; logoUrl: string };
  topics: Topic[];
  author: UserCard;
  creditedUser: UserCard | null;
  collaborators: UserCard[];
  media: PostMedia[];
  caseDetails: { contactPhone: string; paymentQrUrl: string; paymentNote: string } | null;
  opportunity: {
    deadline: string | null;
    applyUrl: string;
    mode: "ONLINE" | "IN_PERSON" | "HYBRID";
    location: string;
    isOpen: boolean;
  } | null;
  event: EventSummary | null;
  upvotedByMe: boolean;
}

export interface CommentView {
  id: number;
  postId: number;
  parentId: number | null;
  body: string;
  createdAt: string;
  author: UserCard;
  replies?: CommentView[];
}

export interface EventRoleView {
  id: number;
  name: string;
  seats: number;
  seatsTaken: number;
  seatsLeft: number;
}

export interface EventQuestion {
  id: string;
  text: string;
  required: boolean;
}

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface ApplicationView {
  id: number;
  eventId: number;
  status: ApplicationStatus;
  message: string;
  answers: Record<string, string>;
  createdAt: string;
  decidedAt: string | null;
  role: { id: number; name: string } | null;
  rating: { stars: number; updatedAt: string } | null;
  roleChoices: { rank: number; id: number; name: string }[];
}

/** GET /events/:id: the post view with the full event block and the viewer's application. */
export interface EventPage extends Omit<PostView, "event"> {
  event: EventSummary & {
    latitude: number | null;
    longitude: number | null;
    autoClosedAt: string | null;
    documentation: string;
    documentedAt: string | null;
    documentationDueAt: string;
    documentationMedia: PostMedia[];
    impactMetrics: { label: string; value: number }[];
    questions: EventQuestion[];
    roles: EventRoleView[];
    applicationsOpen: boolean;
    isOrganizer: boolean;
  };
  myApplication: ApplicationView | null;
}

/** What an organizer sees of an applicant (the person's privacy switches apply). */
export interface ApplicantProfile {
  id: number;
  name: string;
  avatarUrl: string;
  bio: string;
  verifiedKind: VerifiedKind | null;
  age: number | null;
  address: { governorate: Governorate | null; city: string; neighborhood: string } | null;
  education: { level: EducationLevel | null; fieldOfStudy: string } | null;
  workField: string | null;
}

export interface OrganizerApplication extends ApplicationView {
  applicant: ApplicantProfile;
}

/** GET /event-applications/organizer: one application with the event it was sent to. */
export interface OrganizerInboxApplication extends OrganizerApplication {
  event: { id: number; title: string; status: string; startsAt: string; hasRoles: boolean };
}

export interface BadgeView {
  id: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED";
  kind: "BADGE" | "CERTIFICATE";
  description: string;
  isShownOnProfile: boolean;
  createdAt: string;
  decidedAt: string | null;
  imageUrl: string;
  applicationId: number;
  role: { id: number; name: string } | null;
  holder: UserCard;
  event: {
    id: number;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    documentedAt: string | null;
    section: { id: number; slug: string; nameAr: string; nameEn: string; logoUrl: string };
    organizer: UserCard;
  };
}

/** GET /users/me/cv: what the printable volunteer CV shows. */
export interface VolunteerCv {
  generatedAt: string;
  person: {
    id: number;
    name: string;
    avatarUrl: string;
    bio: string;
    verifiedKind: VerifiedKind | null;
    governorate: Governorate | null;
    city: string;
    educationLevel: EducationLevel | null;
    fieldOfStudy: string;
    workField: string;
  };
  stats: { completedEvents: number; volunteerHours: number; approvedBadges: number };
  badges: {
    id: number;
    kind: "BADGE" | "CERTIFICATE";
    description: string;
    approvedAt: string | null;
    role: string | null;
    event: {
      id: number;
      title: string;
      startsAt: string;
      endsAt: string | null;
      section: { slug: string; nameAr: string; nameEn: string; logoUrl: string };
      organizer: UserCard;
    };
  }[];
  teams: {
    id: number;
    role: string;
    description: string;
    startYear: number | null;
    endYear: number | null;
    team: UserCard;
  }[];
  impact: { label: string; total: number }[];
}

/** GET /users/:id: what anyone sees of a user (hidden groups are null). */
export interface PublicProfileView extends ApplicantProfile {
  isPartner: boolean;
  isOfficial: boolean;
  createdAt: string;
  foundedYear: number | null;
  specialties: { id: number; name: string }[];
}

/** GET /users/:id/organizer-stats */
export interface OrganizerStats {
  completedEvents: number;
  acceptedVolunteers: number;
  impact: { label: string; total: number }[];
  rating: { hidden: boolean; enoughRatings: boolean; average: number | null; count: number | null };
  /** Weeks this account was "organization of the week". */
  weeklyHighlights: number;
}

/** A team membership shown on a profile (GET /users/:id/teams). */
export interface ProfileTeam {
  id: number;
  role: string;
  startYear: number | null;
  endYear: number | null;
  team: UserCard;
}

/** GET /team-memberships/me: the user's own membership requests. */
export interface MyMembership {
  id: number;
  status: MembershipStatus;
  role: string;
  startYear: number | null;
  endYear: number | null;
  team: UserCard;
}

/** GET /team-memberships/incoming: a request to join (or a member of) the caller's team. */
export interface IncomingMembership {
  id: number;
  status: MembershipStatus;
  role: string;
  description: string;
  startYear: number | null;
  endYear: number | null;
  createdAt: string;
  decidedAt: string | null;
  user: UserCard;
}

/** GET /users/:id/members: an approved member shown on a team's page. */
export interface TeamMember {
  id: number;
  role: string;
  startYear: number | null;
  endYear: number | null;
  user: UserCard;
}

/** GET /search/directory: one verified account in the directory. */
export interface DirectoryAccount extends UserCard {
  bio: string;
  region: { governorate: Governorate; city: string } | null;
  specialties: { id: number; name: string }[];
  sectionIds: number[];
  completedEvents: number;
  /** average / count are null when hidden or under 3 ratings. */
  rating: { hidden: boolean; average: number | null; count: number | null };
}

export interface DirectoryPage extends PaginatedOf<DirectoryAccount> {
  sections: { sectionId: number; count: number }[];
}

/** GET /users/me/posts: a verified account's own posts and events, with what waits for it. */
export interface MyPostsPage {
  data: (PostView & { waiting: { applications: number; badges: number } | null })[];
  meta: PaginatedOf<PostView>["meta"];
  counts: { all: number; posts: number; events: number; hidden: number };
}

// API response types used by the web. Dates from the API are ISO strings.
import type {
  EducationLevel,
  Governorate,
  Locale,
  UserRole,
  VerifiedKind,
} from './enums';

export type { ApiError, Paginated } from './api';

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
  status: 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  startsAt: string;
  endsAt: string | null;
  applicationDeadline: string | null;
  capacity: number | null;
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
  kind: 'POST' | 'EVENT';
  status: 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  title: string;
  body: string;
  upvoteCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  section: {
    id: number;
    slug: string;
    nameAr: string;
    nameEn: string;
    logoUrl: string;
  };
  topics: Topic[];
  author: UserCard;
  creditedUser: UserCard | null;
  collaborators: UserCard[];
  media: PostMedia[];
  caseDetails: {
    contactPhone: string;
    paymentQrUrl: string;
    paymentNote: string;
  } | null;
  opportunity: {
    deadline: string | null;
    applyUrl: string;
    mode: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
    location: string;
    isOpen: boolean;
    eligibility: string;
    minAge: number | null;
    maxAge: number | null;
    educationLevel: EducationLevel | null;
    field: string;
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

import type { ApplicationStatus } from './enums';

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
export interface EventPage extends Omit<PostView, 'event'> {
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
  address: {
    governorate: Governorate | null;
    city: string;
    neighborhood: string;
  } | null;
  education: { level: EducationLevel | null; fieldOfStudy: string } | null;
  workField: string | null;
}

export interface OrganizerApplication extends ApplicationView {
  applicant: ApplicantProfile;
}

export interface BadgeView {
  id: number;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REVOKED';
  kind: 'BADGE' | 'CERTIFICATE';
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
    section: {
      id: number;
      slug: string;
      nameAr: string;
      nameEn: string;
      logoUrl: string;
    };
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
  stats: {
    completedEvents: number;
    approvedBadges: number;
    /** Sum of scheduled hours for the volunteer's completed, accepted events. */
    volunteerHours: number;
  };
  badges: {
    id: number;
    kind: 'BADGE' | 'CERTIFICATE';
    description: string;
    approvedAt: string | null;
    role: string | null;
    event: {
      id: number;
      title: string;
      startsAt: string;
      endsAt: string | null;
      section: {
        slug: string;
        nameAr: string;
        nameEn: string;
        logoUrl: string;
      };
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
  rating: {
    hidden: boolean;
    enoughRatings: boolean;
    average: number | null;
    count: number | null;
  };
  /** Weeks this account was "organization of the week". */
  weeklyHighlights: number;
}

/** GET /highlights/current and each item of GET /highlights (dates in ISO 8601 UTC). */
export interface WeeklyHighlight {
  /** Saturday 00:00 Damascus. */
  weekStart: string;
  weekEnd: string;
  /** Volunteers whose first completed event on the platform was with this organizer. */
  newVolunteers: number;
  /** null when nobody brought enough first-time volunteers that week. */
  organizer: {
    id: number;
    name: string;
    avatarUrl: string;
    verifiedKind: string | null;
    isPartner: boolean;
    isOfficial: boolean;
    city: string;
    governorate: string | null;
  } | null;
}

/** A team membership shown on a profile (GET /users/:id/teams). */
export interface ProfileTeam {
  id: number;
  role: string;
  startYear: number | null;
  endYear: number | null;
  team: UserCard;
}

// ── Statistics (GET /admin/stats for admins, GET /users/me/stats for a verified account) ──

/** Time window of a statistics report, counted back from today. */
export const STATS_PERIODS = ['30d', '90d', '365d', 'all'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** Groups smaller than this are reported as null ("fewer than 5"), so nobody can be singled out. */
export const STATS_MIN_GROUP = 5;

export interface StatsTotals {
  /** Campaigns (events) starting in the period, any status. */
  campaigns: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  /** Distinct people accepted in completed campaigns. */
  volunteers: number;
  /** People whose first completed campaign on the platform is in the period (and, for an
   *  organizer, was one of its own). */
  newVolunteers: number;
  /** Sum over completed campaigns of accepted people × the campaign's hours. */
  volunteerHours: number;
  /** Active organizers (ran a completed campaign in the period). */
  organizers: number;
}

/** Demand numbers of a group of past, not cancelled campaigns. */
export interface StatsDemand {
  campaigns: number;
  completed: number;
  /** Applications that were not withdrawn. */
  applicants: number;
  seats: number;
  accepted: number;
  rejected: number;
  /** Seats left empty in completed campaigns. */
  unfilledSeats: number;
  /** applicants ÷ seats (null with no seats). Above 1: more people than places. */
  applicantsPerSeat: number | null;
  /** accepted ÷ seats (null with no seats). */
  fillRate: number | null;
  /** Average upvotes per campaign post. */
  upvotesPerCampaign: number | null;
}

export type StatsSignal = 'NEEDS_CAMPAIGNS' | 'NEEDS_VOLUNTEERS' | null;

export interface StatsReport {
  scope: 'platform' | 'organizer';
  period: { key: StatsPeriod; from: string | null; to: string };
  filters: { governorate: string | null; sectionId: number | null };
  totals: StatsTotals;
  /** Same totals for the window just before (null for "all"), to show the change. */
  previous: StatsTotals | null;
  /** Completed campaigns per month (Damascus time), oldest first. */
  byMonth: { month: string; campaigns: number; volunteers: number; hours: number }[];
  bySection: (StatsDemand & { sectionId: number; slug: string; nameAr: string })[];
  byTopic: (StatsDemand & { topicId: number; nameAr: string; sectionSlug: string })[];
  byGovernorate: (StatsDemand & {
    governorate: string;
    /** Platform only: people who live there, verified accounts based there, humanitarian
     *  cases and publish requests from there. Null in an organizer's report. */
    registeredVolunteers: number | null;
    /** Platform only: people living there per past campaign there. */
    peoplePerCampaign: number | null;
    organizers: number | null;
    cases: number | null;
    publishRequests: number | null;
    signal: StatsSignal;
  })[];
  impact: { label: string; total: number }[];
  volunteers: {
    /** People whose first completed campaign on the platform is one of these campaigns. */
    firstTime: number;
    /** People who took part in two or more of these campaigns (a person can be in both). */
    returning: number;
    /** Age on the day of the report. "hidden": the person does not show it (organizer view). */
    ageGroups: { group: '13-17' | '18-24' | '25-34' | '35+' | 'hidden'; count: number | null }[];
    education: { level: string; count: number | null }[];
  };
  ratings: { average: number | null; count: number; distribution: number[] };
  /** Platform only. */
  topOrganizers:
    | {
        id: number;
        name: string;
        verifiedKind: string | null;
        completed: number;
        volunteers: number;
        newVolunteers: number;
        ratingAverage: number | null;
        ratingCount: number;
      }[]
    | null;
  /** Platform only: what people ask for. */
  requests: {
    publishRequestsBySection: { sectionId: number; nameAr: string; total: number; approved: number }[];
    casesByTopic: { topicId: number | null; nameAr: string; total: number }[];
  } | null;
}

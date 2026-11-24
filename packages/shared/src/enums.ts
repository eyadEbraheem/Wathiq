// Mirrors the enums in api/prisma/schema.prisma. Keep in sync when the schema changes.

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const VerifiedKind = {
  ORGANIZATION: 'ORGANIZATION',
  INDIVIDUAL: 'INDIVIDUAL',
} as const;
export type VerifiedKind = (typeof VerifiedKind)[keyof typeof VerifiedKind];

export const Locale = {
  ar: 'ar',
  en: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const Governorate = {
  DAMASCUS: 'DAMASCUS',
  RIF_DIMASHQ: 'RIF_DIMASHQ',
  ALEPPO: 'ALEPPO',
  HOMS: 'HOMS',
  HAMA: 'HAMA',
  LATAKIA: 'LATAKIA',
  TARTUS: 'TARTUS',
  IDLIB: 'IDLIB',
  RAQQA: 'RAQQA',
  DEIR_EZ_ZOR: 'DEIR_EZ_ZOR',
  HASAKAH: 'HASAKAH',
  DARAA: 'DARAA',
  SUWAYDA: 'SUWAYDA',
  QUNEITRA: 'QUNEITRA',
} as const;
export type Governorate = (typeof Governorate)[keyof typeof Governorate];

export const EducationLevel = {
  NONE: 'NONE',
  PRIMARY: 'PRIMARY',
  PREPARATORY: 'PREPARATORY',
  SECONDARY: 'SECONDARY',
  INSTITUTE: 'INSTITUTE',
  BACHELOR: 'BACHELOR',
  MASTER: 'MASTER',
  DOCTORATE: 'DOCTORATE',
} as const;
export type EducationLevel = (typeof EducationLevel)[keyof typeof EducationLevel];

export const MembershipStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REMOVED: 'REMOVED',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const OtpChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
} as const;
export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

export const OtpPurpose = {
  CONTACT_VERIFY: 'CONTACT_VERIFY',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const VerificationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const DocumentType = {
  ID_CARD: 'ID_CARD',
  PASSPORT: 'PASSPORT',
  SUPPORTING: 'SUPPORTING',
  ORGANIZATION_PAPER: 'ORGANIZATION_PAPER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const PostKind = {
  POST: 'POST',
  EVENT: 'EVENT',
} as const;
export type PostKind = (typeof PostKind)[keyof typeof PostKind];

export const PostStatus = {
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const MediaPhase = {
  MAIN: 'MAIN',
  DOCUMENTATION: 'DOCUMENTATION',
} as const;
export type MediaPhase = (typeof MediaPhase)[keyof typeof MediaPhase];

export const EventStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const ApplicationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const BadgeStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
} as const;
export type BadgeStatus = (typeof BadgeStatus)[keyof typeof BadgeStatus];

export const CollaborationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
} as const;
export type CollaborationStatus = (typeof CollaborationStatus)[keyof typeof CollaborationStatus];

export const PublishRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type PublishRequestStatus = (typeof PublishRequestStatus)[keyof typeof PublishRequestStatus];

export const Attribution = {
  PUBLISHER: 'PUBLISHER',
  REQUESTER: 'REQUESTER',
} as const;
export type Attribution = (typeof Attribution)[keyof typeof Attribution];

export const CommentStatus = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

export const ReportTarget = {
  POST: 'POST',
  COMMENT: 'COMMENT',
  USER: 'USER',
} as const;
export type ReportTarget = (typeof ReportTarget)[keyof typeof ReportTarget];

export const ReportReason = {
  FRAUD: 'FRAUD',
  OFFENSIVE: 'OFFENSIVE',
  SPAM: 'SPAM',
  MISLEADING: 'MISLEADING',
  OTHER: 'OTHER',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const NotificationType = {
  FOLLOWED_ACCOUNT_POSTED: 'FOLLOWED_ACCOUNT_POSTED',
  SECTION_NEW_POST: 'SECTION_NEW_POST',
  TOPIC_NEW_POST: 'TOPIC_NEW_POST',
  COLLAB_INVITED: 'COLLAB_INVITED',
  COLLAB_ACCEPTED: 'COLLAB_ACCEPTED',
  EVENT_APPLICATION_RECEIVED: 'EVENT_APPLICATION_RECEIVED',
  EVENT_APPLICATION_DECIDED: 'EVENT_APPLICATION_DECIDED',
  EVENT_DOCUMENTED: 'EVENT_DOCUMENTED',
  EVENT_DOCUMENTATION_OVERDUE: 'EVENT_DOCUMENTATION_OVERDUE',
  BADGE_REQUESTED: 'BADGE_REQUESTED',
  BADGE_DECIDED: 'BADGE_DECIDED',
  COMMENT_ON_POST: 'COMMENT_ON_POST',
  COMMENT_REPLY: 'COMMENT_REPLY',
  PUBLISH_REQUEST_RECEIVED: 'PUBLISH_REQUEST_RECEIVED',
  PUBLISH_REQUEST_DECIDED: 'PUBLISH_REQUEST_DECIDED',
  VERIFICATION_DECIDED: 'VERIFICATION_DECIDED',
  TEAM_MEMBERSHIP_REQUESTED: 'TEAM_MEMBERSHIP_REQUESTED',
  TEAM_MEMBERSHIP_DECIDED: 'TEAM_MEMBERSHIP_DECIDED',
  CONTENT_MODERATED: 'CONTENT_MODERATED',
  EVENT_ROLE_CHANGED: 'EVENT_ROLE_CHANGED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  EVENT_APPLICATION_WITHDRAWN: 'EVENT_APPLICATION_WITHDRAWN',
  WEEKLY_HIGHLIGHT: 'WEEKLY_HIGHLIGHT',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const OpportunityMode = {
  ONLINE: 'ONLINE',
  IN_PERSON: 'IN_PERSON',
  HYBRID: 'HYBRID',
} as const;
export type OpportunityMode = (typeof OpportunityMode)[keyof typeof OpportunityMode];

export const DevicePlatform = {
  IOS: 'IOS',
  ANDROID: 'ANDROID',
  WEB: 'WEB',
} as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

/**
 * The papers an organization sends with its verification request, in order (a document's
 * `slot` is its index here). Every one is required. Labels are not agreed yet: clients show
 * "الورقة 1", "الورقة 2", ... while a label is empty. Changing this list changes the API rule.
 */
export const ORGANIZATION_PAPERS: readonly { labelAr: string; labelEn: string }[] = [
  { labelAr: '', labelEn: '' },
  { labelAr: '', labelEn: '' },
  { labelAr: '', labelEn: '' },
];

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  BadgeStatus,
  EventStatus,
  MembershipStatus,
  PostStatus,
  type Prisma,
  type User,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { sumImpact } from 'src/organizers/impact';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { ageOn } from 'src/common/utils/age';
import { CvSigner, OFFLINE_CV_VERSION } from 'src/cv/cv-signer';
import { loadSectionLogos } from 'src/cv/cv-pdf-images';
import { cvPdfFooter, cvPdfHtml } from 'src/cv/cv-pdf-template';
import { CvPdfService } from 'src/cv/cv-pdf.service';
import { toPublicProfile } from 'src/users/public-profile';
import { USER_CARD_SELECT } from 'src/users/user-card';

const EDUCATION = 'education';
/** Under this age the public CV hides personal fields and teams (same rule as the profile). */
const ADULT_AGE = 18;

/** 24 random bytes as base64url: 32 characters nobody can guess. */
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const newShareToken = () => randomBytes(24).toString('base64url');

/**
 * The caller's volunteer CV: its data (the clients render it), a ready PDF file of it, and its
 * public link.
 */
@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: CvSigner,
    private readonly pdfRenderer: CvPdfService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The caller's CV as an A4 PDF file, the same content as `build` (made on the server, so the
   * web and the mobile app download the same file).
   */
  async pdf(userId: number): Promise<{ file: Buffer; name: string }> {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true, pendingOrganization: true },
    });
    if (!owner) throw new NotFoundException(`No user found with id ${userId}.`);
    this.refuseOrganization(owner);
    const cv = await this.build(userId);
    const logos = await loadSectionLogos(
      cv.badges.map((b) => b.event.section.logoUrl),
      this.storage,
    );
    const file = await this.pdfRenderer.render(
      cvPdfHtml(cv, logos),
      cvPdfFooter(cv),
    );
    this.logger.log(`User ${userId} downloaded their CV as PDF.`);
    return { file, name: cv.person.name };
  }

  /**
   * Whether the caller's CV is shared, the token of its public link, and `offline`: a signed
   * copy of the public CV for the QR, so the Wathiq app can show it without internet (null
   * while not shared or when signing is off).
   */
  async getShare(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`No user found with id ${userId}.`);
    return this.shareView(user);
  }

  /**
   * Turns sharing on with a new random link. Called again, it replaces the link, so the old one
   * (and any printed QR of it) stops working.
   */
  async enableShare(userId: number) {
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verifiedKind: true, pendingOrganization: true },
    });
    if (!owner) throw new NotFoundException(`No user found with id ${userId}.`);
    this.refuseOrganization(owner);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { cvShareToken: newShareToken() },
    });
    this.logger.log(`User ${userId} created a new public CV link.`);
    return this.shareView(user);
  }

  /** Turns sharing off: the public link answers 404 from now on. */
  async disableShare(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { cvShareToken: null },
    });
    this.logger.log(`User ${userId} stopped sharing their CV.`);
  }

  /**
   * The CV behind a public link, built fresh on every request (current data, not a snapshot).
   * Unknown, switched-off, deleted or suspended accounts (and organizations) all get the same
   * 404. Anyone can open the link, so personal fields follow the owner's privacy settings like
   * the public profile: address, education, work field and teams only when shown, never for
   * users under 18.
   */
  async buildPublic(token: string) {
    const notFound = new NotFoundException(
      'This CV link is not valid or is no longer shared.',
    );
    if (!SHARE_TOKEN_PATTERN.test(token)) throw notFound;
    const user = await this.prisma.user.findFirst({
      where: {
        cvShareToken: token,
        deletedAt: null,
        isSuspended: false,
        pendingOrganization: false,
        // Not `NOT: ORGANIZATION`: in SQL that would also drop regular accounts (NULL).
        OR: [{ verifiedKind: null }, { verifiedKind: 'INDIVIDUAL' }],
      },
    });
    if (!user) throw notFound;
    return this.publicCvOf(user);
  }

  /** The Ed25519 public key that checks offline copies (raw 32 bytes, base64). */
  signingKey() {
    return { algorithm: 'Ed25519', publicKey: this.signer.publicKey };
  }

  /** The public CV of a sharing user: their CV with personal fields filtered by privacy. */
  private async publicCvOf(user: User) {
    const cv = await this.build(user.id);
    const profile = toPublicProfile(user);
    return {
      ...cv,
      person: {
        ...cv.person,
        governorate: profile.address?.governorate ?? null,
        city: profile.address?.city ?? '',
        educationLevel: profile.education?.level ?? null,
        fieldOfStudy: profile.education?.fieldOfStudy ?? '',
        workField: profile.workField ?? '',
      },
      // Teams follow the same switch as on the profile (and stay hidden under 18).
      teams:
        user.showTeams && ageOn(user.birthDate) >= ADULT_AGE ? cv.teams : [],
    };
  }

  /** An organization does not volunteer, so it has no volunteer CV to share or download. */
  private refuseOrganization(
    owner: Pick<User, 'verifiedKind' | 'pendingOrganization'>,
  ) {
    if (owner.verifiedKind === 'ORGANIZATION' || owner.pendingOrganization) {
      throw new ForbiddenException('Organizations have no volunteer CV.');
    }
  }

  private async shareView(user: User) {
    const token = user.cvShareToken;
    if (!token || !this.signer.enabled) {
      return { enabled: token !== null, token, offline: null };
    }
    const cv = await this.publicCvOf(user);
    const cut = (text: string, max: number) => text.slice(0, max);
    const offline = this.signer.signCopy({
      v: OFFLINE_CV_VERSION,
      t: token,
      at: cv.generatedAt.toISOString(),
      p: {
        n: cv.person.name,
        g: cv.person.governorate,
        c: cut(cv.person.city, 60),
        e: cv.person.educationLevel,
        f: cut(cv.person.fieldOfStudy, 80),
        w: cut(cv.person.workField, 80),
      },
      s: {
        e: cv.stats.completedEvents,
        h: cv.stats.volunteerHours,
        b: cv.stats.approvedBadges,
      },
      b: cv.badges.map((b) => [
        cut(b.event.title, 80),
        b.event.startsAt.toISOString().slice(0, 10),
        cut(b.event.organizer.name, 60),
        b.event.section.nameAr,
        b.role ?? '',
        b.kind === 'CERTIFICATE' ? 'C' : 'B',
      ]),
      n: cv.badges.length,
      m: cv.teams.map((t) => [
        cut(t.team.name, 60),
        cut(t.role, 40),
        t.startYear ?? 0,
        t.endYear ?? 0,
      ]),
      i: cv.impact.map((m) => [cut(m.label, 40), m.total]),
    });
    return { enabled: true, token, offline };
  }

  async build(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        verifiedKind: true,
        governorate: true,
        city: true,
        educationLevel: true,
        fieldOfStudy: true,
        workField: true,
        deletedAt: true,
      },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }

    // Events the user really took part in: accepted, and completed (documented).
    const participated: Prisma.EventWhereInput = {
      status: EventStatus.COMPLETED,
      post: { status: { not: PostStatus.DELETED } },
      applications: { some: { userId, status: ApplicationStatus.ACCEPTED } },
    };

    const [badges, teams, completedEvents, hours, metrics] = await Promise.all([
      this.prisma.badge.findMany({
        where: {
          userId,
          status: BadgeStatus.APPROVED,
          isShownOnProfile: true,
          event: { post: { status: { not: PostStatus.DELETED } } },
        },
        orderBy: { event: { startsAt: 'desc' } },
        select: {
          id: true,
          description: true,
          decidedAt: true,
          application: { select: { role: { select: { name: true } } } },
          event: {
            select: {
              postId: true,
              startsAt: true,
              endsAt: true,
              post: {
                select: {
                  title: true,
                  author: { select: USER_CARD_SELECT },
                  section: {
                    select: {
                      slug: true,
                      nameAr: true,
                      nameEn: true,
                      logoUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.teamMembership.findMany({
        where: {
          userId,
          status: MembershipStatus.APPROVED,
          team: { deletedAt: null },
        },
        orderBy: [{ startYear: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          role: true,
          description: true,
          startYear: true,
          endYear: true,
          team: { select: USER_CARD_SELECT },
        },
      }),
      this.prisma.event.count({ where: participated }),
      this.prisma.event.aggregate({
        where: participated,
        _sum: { volunteerHours: true },
      }),
      this.prisma.eventImpactMetric.findMany({
        where: { event: participated },
        orderBy: { id: 'desc' },
        select: { label: true, normalized: true, value: true },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletedAt, ...person } = user;
    return {
      generatedAt: new Date(),
      person,
      stats: {
        completedEvents,
        // Sum of the hours of every completed event the user was accepted into.
        volunteerHours: hours._sum.volunteerHours ?? 0,
        approvedBadges: badges.length,
      },
      badges: badges.map((b) => ({
        id: b.id,
        kind:
          b.event.post.section.slug === EDUCATION
            ? ('CERTIFICATE' as const)
            : ('BADGE' as const),
        description: b.description,
        approvedAt: b.decidedAt,
        role: b.application.role?.name ?? null,
        event: {
          id: b.event.postId,
          title: b.event.post.title,
          startsAt: b.event.startsAt,
          endsAt: b.event.endsAt,
          section: b.event.post.section,
          organizer: b.event.post.author,
        },
      })),
      teams,
      impact: sumImpact(metrics),
    };
  }
}

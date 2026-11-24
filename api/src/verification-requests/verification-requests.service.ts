import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  NotificationType,
  Prisma,
  VerificationStatus,
  VerifiedKind,
} from '@prisma/client';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AllowedMimeType } from 'src/storage/file-type';
import {
  IncomingFile,
  StorageService,
  StoredFile,
} from 'src/storage/storage.service';
import type { CreateVerificationRequestDto } from 'src/verification-requests/dto/create-verification-request.dto';
import type { FindVerificationRequestsQueryDto } from 'src/verification-requests/dto/find-verification-requests-query.dto';

export interface UploadedDocument extends IncomingFile {
  originalname: string;
}

const DOCUMENT_TYPES: AllowedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_SUPPORTING_DOCUMENTS = 3;
/**
 * Papers an ORGANIZATION request must include, one per slot. Mirrors ORGANIZATION_PAPERS in
 * packages/shared (their labels are agreed later); keep the two in sync.
 */
export const ORGANIZATION_PAPER_COUNT = 3;
/** Signed document links shown to admins stay valid this long. */
const DOCUMENT_URL_TTL_SECONDS = 5 * 60;

/** Fields a user sees of their own request. Documents are never listed back to them. */
const OWN_REQUEST_SELECT = {
  id: true,
  kind: true,
  status: true,
  contactPhone: true,
  foundedAt: true,
  details: true,
  links: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.VerificationRequestSelect;

@Injectable()
export class VerificationRequestsService {
  private readonly logger = new Logger(VerificationRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Applicant ─────────────────────────────────────────────────────────────

  async create(
    userId: number,
    dto: CreateVerificationRequestDto,
    idDocument: UploadedDocument | undefined,
    supporting: UploadedDocument[] = [],
    papers: UploadedDocument[] = [],
  ) {
    if (!idDocument) {
      throw new BadRequestException(
        'An ID card or passport image is required.',
      );
    }
    if (supporting.length > MAX_SUPPORTING_DOCUMENTS) {
      throw new BadRequestException(
        `At most ${MAX_SUPPORTING_DOCUMENTS} supporting documents are allowed.`,
      );
    }
    // An organization sends every paper, in slot order; a person sends none.
    if (
      dto.kind === VerifiedKind.ORGANIZATION &&
      papers.length !== ORGANIZATION_PAPER_COUNT
    ) {
      throw new BadRequestException(
        `An organization must send all ${ORGANIZATION_PAPER_COUNT} papers.`,
      );
    }
    if (dto.kind === VerifiedKind.INDIVIDUAL && papers.length > 0) {
      throw new BadRequestException(
        'Organization papers are only for organization requests.',
      );
    }
    const foundedAt = this.foundedAtFor(dto);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException(`No user found with id ${userId}.`);
    }
    if (user.verifiedKind) {
      throw new BadRequestException('Your account is already verified.');
    }
    // An account that signed up as an organization can only be verified as one.
    if (user.pendingOrganization && dto.kind !== VerifiedKind.ORGANIZATION) {
      throw new BadRequestException(
        'This account signed up as an organization: request ORGANIZATION verification.',
      );
    }
    await this.assertNoPendingRequest(userId);

    // Files first (validated by type and size), then the rows. If the rows fail, the files
    // are removed again so nothing is left behind in private storage.
    const stored: {
      file: StoredFile;
      type: DocumentType;
      name: string;
      slot: number | null;
    }[] = [];
    try {
      const all = [
        {
          upload: idDocument,
          type: dto.idDocumentType as DocumentType,
          slot: null,
        },
        ...supporting.map((upload) => ({
          upload,
          type: DocumentType.SUPPORTING,
          slot: null,
        })),
        ...papers.map((upload, slot) => ({
          upload,
          type: DocumentType.ORGANIZATION_PAPER,
          slot,
        })),
      ];
      for (const { upload, type, slot } of all) {
        const file = await this.storage.save(upload, {
          visibility: 'private',
          allowed: DOCUMENT_TYPES,
          maxBytes: MAX_DOCUMENT_BYTES,
        });
        stored.push({ file, type, name: this.cleanFileName(upload), slot });
      }

      const request = await this.prisma.verificationRequest.create({
        data: {
          userId,
          kind: dto.kind,
          contactPhone: dto.contactPhone,
          foundedAt,
          details: dto.details ?? '',
          links: dto.links ?? [],
          documents: {
            create: stored.map(({ file, type, name, slot }) => ({
              type,
              slot,
              storageKey: file.key,
              fileName: name,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
            })),
          },
        },
        select: OWN_REQUEST_SELECT,
      });
      this.logger.log(
        `Verification request ${request.id} created by user ${userId}.`,
      );
      return request;
    } catch (error) {
      await Promise.all(
        stored.map(({ file }) => this.storage.delete(file.key)),
      );
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You already have a verification request waiting for review.',
        );
      }
      throw error;
    }
  }

  async findMine(userId: number, query: FindVerificationRequestsQueryDto) {
    const where: Prisma.VerificationRequestWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.verificationRequest.findMany({
        where,
        select: OWN_REQUEST_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  // ── Admin review ──────────────────────────────────────────────────────────

  /** Review queue, oldest first so nobody waits forever. */
  async findAll(query: FindVerificationRequestsQueryDto) {
    const where: Prisma.VerificationRequestWhereInput = query.status
      ? { status: query.status }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.verificationRequest.findMany({
        where,
        select: {
          ...OWN_REQUEST_SELECT,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  /** One request with short-lived links to its documents (until they are purged). */
  async findOne(id: number) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        reviewedBy: { select: { id: true, name: true } },
        documents: { orderBy: { id: 'asc' } },
      },
    });
    if (!request) {
      throw new NotFoundException(
        `No verification request found with id ${id}.`,
      );
    }
    return {
      ...request,
      documents: request.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        slot: doc.slot,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        purgedAt: doc.purgedAt,
        url: doc.purgedAt
          ? null
          : this.storage.signedUrl(doc.storageKey, DOCUMENT_URL_TTL_SECONDS),
      })),
    };
  }

  /** Verifies the account, notifies the user and deletes the documents. */
  async approve(id: number, adminId: number) {
    const request = await this.findPending(id);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.verificationRequest.update({
        where: { id },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
      await tx.user.update({
        where: { id: request.userId },
        data: {
          verifiedKind: request.kind,
          verifiedAt: now,
          // A newly signed-up organization is no longer frozen.
          pendingOrganization: false,
          // An organization's "birth date" is its founding date.
          ...(request.kind === 'ORGANIZATION' && request.foundedAt
            ? { birthDate: request.foundedAt }
            : {}),
        },
      });
      await this.markDocumentsPurged(tx, id, now);
      await this.notifyDecision(tx, request.userId, adminId, id, 'APPROVED');
    });
    await this.deleteDocumentFiles(request.documents);
    this.logger.log(
      `Verification request ${id} approved by admin ${adminId}; user ${request.userId} verified.`,
    );
    return this.findOne(id);
  }

  /** Rejects with a reason shown to the user, who may apply again. Documents are deleted. */
  async reject(id: number, adminId: number, reason: string) {
    const request = await this.findPending(id);
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.verificationRequest.update({
        where: { id },
        data: {
          status: VerificationStatus.REJECTED,
          rejectionReason: reason,
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
      await this.markDocumentsPurged(tx, id, now);
      await this.notifyDecision(tx, request.userId, adminId, id, 'REJECTED');
    });
    await this.deleteDocumentFiles(request.documents);
    this.logger.log(`Verification request ${id} rejected by admin ${adminId}.`);
    return this.findOne(id);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Organizations must give their founding date; individuals must not. */
  private foundedAtFor(dto: CreateVerificationRequestDto): Date | null {
    if (dto.kind !== 'ORGANIZATION') {
      if (dto.foundedAt) {
        throw new BadRequestException('foundedAt is only for organizations.');
      }
      return null;
    }
    if (!dto.foundedAt) {
      throw new BadRequestException(
        'Organizations must give their founding date (foundedAt).',
      );
    }
    const foundedAt = new Date(`${dto.foundedAt}T00:00:00.000Z`);
    if (foundedAt > new Date()) {
      throw new BadRequestException('foundedAt cannot be in the future.');
    }
    return foundedAt;
  }

  private async assertNoPendingRequest(userId: number): Promise<void> {
    const pending = await this.prisma.verificationRequest.findFirst({
      where: { userId, status: VerificationStatus.PENDING },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a verification request waiting for review.',
      );
    }
  }

  private async findPending(id: number) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!request) {
      throw new NotFoundException(
        `No verification request found with id ${id}.`,
      );
    }
    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException(
        `This request was already ${request.status.toLowerCase()}.`,
      );
    }
    return request;
  }

  private markDocumentsPurged(
    tx: Prisma.TransactionClient,
    requestId: number,
    now: Date,
  ) {
    return tx.verificationDocument.updateMany({
      where: { requestId, purgedAt: null },
      data: { purgedAt: now },
    });
  }

  private notifyDecision(
    tx: Prisma.TransactionClient,
    recipientId: number,
    actorId: number,
    requestId: number,
    status: 'APPROVED' | 'REJECTED',
  ) {
    return this.notifications.create(
      {
        recipientId,
        actorId,
        type: NotificationType.VERIFICATION_DECIDED,
        data: { requestId, status },
      },
      tx,
    );
  }

  /** After the decision is committed. A failure is logged, never undoes the decision. */
  private async deleteDocumentFiles(documents: { storageKey: string }[]) {
    for (const doc of documents) {
      try {
        await this.storage.delete(doc.storageKey);
      } catch (error) {
        this.logger.error(
          `Could not delete ${doc.storageKey}: ${String(error)}`,
        );
      }
    }
  }

  private cleanFileName(upload: UploadedDocument): string {
    const name = (upload.originalname || 'document').replace(
      /[^\p{L}\p{N}._ -]/gu,
      '_',
    );
    return name.slice(0, 120);
  }
}

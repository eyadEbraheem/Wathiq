import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AllowWhilePending } from 'src/common/decorators/allow-while-pending.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireRole } from 'src/common/decorators/require-role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { CreateVerificationRequestDto } from 'src/verification-requests/dto/create-verification-request.dto';
import { FindVerificationRequestsQueryDto } from 'src/verification-requests/dto/find-verification-requests-query.dto';
import { RejectVerificationRequestDto } from 'src/verification-requests/dto/reject-verification-request.dto';
import {
  MAX_DOCUMENT_BYTES,
  MAX_SUPPORTING_DOCUMENTS,
  ORGANIZATION_PAPER_COUNT,
  UploadedDocument,
  VerificationRequestsService,
} from 'src/verification-requests/verification-requests.service';

@ApiTags('verification-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('verification-requests')
export class VerificationRequestsController {
  constructor(private readonly requests: VerificationRequestsService) {}

  // ── Applicant ─────────────────────────────────────────────────────────────

  @Post()
  @AllowWhilePending()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idDocument', maxCount: 1 },
        { name: 'supporting', maxCount: MAX_SUPPORTING_DOCUMENTS },
        { name: 'papers', maxCount: ORGANIZATION_PAPER_COUNT },
      ],
      { limits: { fileSize: MAX_DOCUMENT_BYTES } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'contactPhone', 'idDocumentType', 'idDocument'],
      properties: {
        kind: { type: 'string', enum: ['ORGANIZATION', 'INDIVIDUAL'] },
        contactPhone: { type: 'string', example: '+963912345678' },
        details: { type: 'string' },
        links: { type: 'array', items: { type: 'string' } },
        idDocumentType: { type: 'string', enum: ['ID_CARD', 'PASSPORT'] },
        idDocument: { type: 'string', format: 'binary' },
        supporting: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        papers: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `ORGANIZATION only, required: exactly ${ORGANIZATION_PAPER_COUNT} files, in the order of ORGANIZATION_PAPERS (packages/shared).`,
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Ask to become a verified account (ID document stored privately)',
  })
  @ApiResponse({ status: 201, description: 'Request submitted.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid data, missing/invalid file, or already verified.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 409, description: 'A request is already pending.' })
  @ApiResponse({ status: 413, description: 'A file is larger than 10 MB.' })
  create(
    @CurrentUser() me: AuthUser,
    @Body() dto: CreateVerificationRequestDto,
    @UploadedFiles()
    files: {
      idDocument?: UploadedDocument[];
      supporting?: UploadedDocument[];
      papers?: UploadedDocument[];
    },
  ) {
    return this.requests.create(
      me.id,
      dto,
      files?.idDocument?.[0],
      files?.supporting,
      files?.papers,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Your own verification requests and their status' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  findMine(
    @CurrentUser() me: AuthUser,
    @Query() query: FindVerificationRequestsQueryDto,
  ) {
    return this.requests.findMine(me.id, query);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  @Get()
  @RequireRole([UserRole.ADMIN])
  @ApiOperation({ summary: '[Admin] Review queue (oldest first)' })
  @ApiResponse({ status: 200, description: '{ data, meta }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Admins only.' })
  findAll(@Query() query: FindVerificationRequestsQueryDto) {
    return this.requests.findAll(query);
  }

  @Get(':id')
  @RequireRole([UserRole.ADMIN])
  @ApiOperation({
    summary: '[Admin] One request with 5-minute links to its documents',
  })
  @ApiResponse({ status: 200, description: 'The request.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Admins only.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.requests.findOne(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequireRole([UserRole.ADMIN])
  @ApiOperation({
    summary: '[Admin] Approve: verifies the account and deletes the documents',
  })
  @ApiResponse({ status: 200, description: 'The decided request.' })
  @ApiResponse({ status: 400, description: 'Already decided.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Admins only.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.requests.approve(id, admin.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequireRole([UserRole.ADMIN])
  @ApiOperation({
    summary: '[Admin] Reject with a reason; documents are deleted',
  })
  @ApiResponse({ status: 200, description: 'The decided request.' })
  @ApiResponse({ status: 400, description: 'Already decided or no reason.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Admins only.' })
  @ApiResponse({ status: 404, description: 'No such request.' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: AuthUser,
    @Body() dto: RejectVerificationRequestDto,
  ) {
    return this.requests.reject(id, admin.id, dto.reason);
  }
}

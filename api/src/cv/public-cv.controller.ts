import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CvService } from 'src/cv/cv.service';

/** Stricter per-IP limit: the link is public, so guessing tokens must stay slow. */
const PUBLIC_LINK = { default: { limit: 30, ttl: 60_000 } };

/** Account-free reading of a CV its owner chose to share (the QR on the web opens it). */
@ApiTags('cv')
@Controller('cv')
export class PublicCvController {
  constructor(private readonly cv: CvService) {}

  @Get('public/:token')
  @Throttle(PUBLIC_LINK)
  @ApiOperation({
    summary: 'A shared volunteer CV, with its current data (no sign-in needed)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Same shape as GET /users/me/cv: { generatedAt, person, stats, badges, teams, impact }.',
  })
  @ApiResponse({
    status: 404,
    description: 'Unknown link, sharing switched off, or the account is gone.',
  })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  findOne(@Param('token') token: string) {
    return this.cv.buildPublic(token);
  }

  @Get('signing-key')
  @ApiOperation({
    summary:
      'Public key that checks the signed offline copy in a shared CV QR (`offline` of /users/me/cv/share)',
    description:
      'The QR link ends with `#o=<payload>.<signature>` (base64url). payload = raw-deflated JSON (see OfflineCv in api/src/cv/cv-signer.ts); signature = Ed25519 over the payload bytes. Apps should build this key in, to check copies without internet.',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ algorithm: "Ed25519", publicKey: base64 of the raw 32-byte key, or null when signing is off }',
  })
  signingKey() {
    return this.cv.signingKey();
  }
}

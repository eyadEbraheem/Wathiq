import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { CvService } from 'src/cv/cv.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class CvController {
  constructor(private readonly cv: CvService) {}

  @Get('me/cv')
  @ApiOperation({
    summary:
      'Your volunteer CV data: approved badges (event, role, date, organizer), approved teams, impact',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ generatedAt, person, stats, badges, teams, impact }. The client prints it to PDF.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  build(@CurrentUser() user: AuthUser) {
    return this.cv.build(user.id);
  }

  @Get('me/cv/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary:
      'Your volunteer CV as a ready A4 PDF file to download (same content as GET me/cv)',
  })
  @ApiResponse({
    status: 200,
    description:
      'The PDF file (Content-Disposition: attachment). Save it as is; nothing to render on the client.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({
    status: 403,
    description: 'Organizations have no volunteer CV.',
  })
  async downloadPdf(@CurrentUser() user: AuthUser) {
    const { file, name } = await this.cv.pdf(user.id);
    // ASCII fallback for old clients, the Arabic name for the rest (RFC 6266).
    const fileName = `${name} - سيرة تطوعية.pdf`;
    return new StreamableFile(file, {
      type: 'application/pdf',
      disposition: `attachment; filename="wathiq-cv.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      length: file.length,
    });
  }

  @Get('me/cv/share')
  @ApiOperation({
    summary: 'Whether your CV has a public link, and its token',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ enabled, token, offline }. The public link is the web page /cv/share/<token>; token is null when not shared. offline = signed copy for the QR (`#o=<offline>` after the link), null when not shared or signing is off.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  getShare(@CurrentUser() user: AuthUser) {
    return this.cv.getShare(user.id);
  }

  @Post('me/cv/share')
  @ApiOperation({
    summary:
      'Share your CV through a new public link (replaces the old link, which stops working)',
  })
  @ApiResponse({
    status: 201,
    description: '{ enabled: true, token, offline }.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  enableShare(@CurrentUser() user: AuthUser) {
    return this.cv.enableShare(user.id);
  }

  @Delete('me/cv/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Stop sharing your CV: the public link stops working',
  })
  @ApiResponse({ status: 204, description: 'Sharing is off.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  disableShare(@CurrentUser() user: AuthUser) {
    return this.cv.disableShare(user.id);
  }
}

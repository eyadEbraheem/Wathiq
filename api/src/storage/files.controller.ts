import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { StorageService } from 'src/storage/storage.service';

/** Serves stored files. Private files require a valid, unexpired signature. */
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('public/:name')
  @ApiOperation({ summary: 'A public file (post photo, avatar, ...)' })
  @ApiResponse({ status: 200, description: 'The file.' })
  @ApiResponse({ status: 404, description: 'No such file.' })
  async getPublic(@Param('name') name: string, @Res() res: Response) {
    const file = await this.storage.readPublic(name);
    if (!file) throw new NotFoundException('File not found.');
    res
      .set('Content-Type', file.mimeType)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .set('X-Content-Type-Options', 'nosniff')
      .send(file.body);
  }

  @Get('private/:name')
  @ApiOperation({ summary: 'A private file through a signed URL from the API' })
  @ApiResponse({ status: 200, description: 'The file.' })
  @ApiResponse({
    status: 404,
    description: 'No such file, or the link is invalid or expired.',
  })
  async getPrivate(
    @Param('name') name: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ) {
    const file = await this.storage.readPrivate(
      name,
      Number(expires),
      String(signature ?? ''),
    );
    if (!file) throw new NotFoundException('File not found or link expired.');
    res
      .set('Content-Type', file.mimeType)
      .set('Cache-Control', 'private, no-store')
      .set('X-Content-Type-Options', 'nosniff')
      .send(file.body);
  }
}

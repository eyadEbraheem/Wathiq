import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AllowWhilePending } from 'src/common/decorators/allow-while-pending.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  StorageService,
  type IncomingFile,
} from 'src/storage/storage.service';

/**
 * Upload first, then reference: clients upload each image here and send the returned `key`
 * in the JSON body of the post / case / profile request. Keeps those bodies plain JSON and lets
 * the mobile app show per-image progress.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @AllowWhilePending()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload one image (JPEG, PNG or WebP, max 10 MB)' })
  @ApiResponse({
    status: 201,
    description: '{ key, url, mimeType }. Send `key` when creating content.',
  })
  @ApiResponse({ status: 400, description: 'Missing, empty or not an image.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 413, description: 'Larger than 10 MB.' })
  async uploadImage(@UploadedFile() file: IncomingFile | undefined) {
    if (!file) throw new BadRequestException('file is required.');
    const stored = await this.storage.save(file, {
      visibility: 'public',
      allowed: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
    });
    return {
      key: stored.key,
      url: this.storage.publicUrl(stored.key),
      mimeType: stored.mimeType,
    };
  }
}

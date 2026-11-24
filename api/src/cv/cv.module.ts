import { Module } from '@nestjs/common';
import { CvController } from 'src/cv/cv.controller';
import { CvService } from 'src/cv/cv.service';
import { CvSigner } from 'src/cv/cv-signer';
import { CvPdfService } from 'src/cv/cv-pdf.service';
import { PublicCvController } from 'src/cv/public-cv.controller';

@Module({
  controllers: [CvController, PublicCvController],
  providers: [CvService, CvSigner, CvPdfService],
})
export class CvModule {}

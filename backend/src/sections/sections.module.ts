import { Module } from '@nestjs/common';
import { SectionsController } from 'src/sections/sections.controller';
import { SectionsService } from 'src/sections/sections.service';

@Module({
  controllers: [SectionsController],
  providers: [SectionsService],
})
export class SectionsModule {}

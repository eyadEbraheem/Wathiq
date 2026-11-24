import { Module } from '@nestjs/common';
import { SearchController } from 'src/search/search.controller';
import { SearchService } from 'src/search/search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}

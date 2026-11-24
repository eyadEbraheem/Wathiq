import { Injectable } from '@nestjs/common';
import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { pageArgs, paginated } from 'src/common/utils/paginate';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sections with their active topics, in display order. */
  async findAll(query: PaginationQueryDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.section.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          topics: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              slug: true,
              nameAr: true,
              nameEn: true,
              sortOrder: true,
            },
          },
        },
        ...pageArgs(query),
      }),
      this.prisma.section.count(),
    ]);
    return paginated(data, total, query);
  }
}

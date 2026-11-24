import type { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Shape of every list response (same as `Paginated<T>` in @csh/shared). */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** `skip` / `take` for Prisma from the page query. */
export function pageArgs(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function paginated<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

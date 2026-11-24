import {
  Controller,
  Get,
  Query,
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
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireRole } from 'src/common/decorators/require-role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import type { AuthUser } from 'src/common/types/auth-user';
import { StatsQueryDto } from 'src/stats/dto/stats-query.dto';
import { StatsService } from 'src/stats/stats.service';

const REPORT_DESCRIPTION =
  'StatsReport (packages/shared): totals and the previous window, per month, per section, per topic, per governorate (with NEEDS_CAMPAIGNS / NEEDS_VOLUNTEERS signals), impact, volunteers (first-time vs returning, age groups, education; groups under 5 are null), ratings.';

const csvFile = (csv: string, name: string) =>
  new StreamableFile(Buffer.from(csv, 'utf8'), {
    type: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${name}"`,
  });

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole([UserRole.ADMIN])
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Platform statistics: what campaigns run most, what people ask for, where help is missing',
  })
  @ApiResponse({
    status: 200,
    description: `${REPORT_DESCRIPTION} Platform only: topOrganizers and requests (publish requests per section, humanitarian cases per topic), plus people, organizers, cases and requests per governorate.`,
  })
  @ApiResponse({ status: 400, description: 'Invalid filter.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  report(@Query() query: StatsQueryDto) {
    return this.stats.forPlatform(query);
  }

  @Get('campaigns.csv')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary:
      'Every campaign in the filters, one per line (no names of volunteers)',
  })
  @ApiResponse({ status: 200, description: 'CSV, UTF-8 with BOM.' })
  @ApiResponse({ status: 400, description: 'Invalid filter.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not an admin.' })
  async csv(@Query() query: StatsQueryDto) {
    return csvFile(
      await this.stats.csvForPlatform(query),
      'wathiq-campaigns.csv',
    );
  }
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/stats')
export class MyStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({
    summary: "A verified account's statistics of its own campaigns",
  })
  @ApiResponse({
    status: 200,
    description: `${REPORT_DESCRIPTION} Ages and education count only what each volunteer shows (adults); the rest is "hidden".`,
  })
  @ApiResponse({ status: 400, description: 'Invalid filter.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not a verified account.' })
  report(@CurrentUser() user: AuthUser, @Query() query: StatsQueryDto) {
    return this.stats.forOrganizer(user.id, query);
  }

  @Get('campaigns.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Your campaigns in the filters, one per line' })
  @ApiResponse({ status: 200, description: 'CSV, UTF-8 with BOM.' })
  @ApiResponse({ status: 400, description: 'Invalid filter.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token.' })
  @ApiResponse({ status: 403, description: 'Not a verified account.' })
  async csv(@CurrentUser() user: AuthUser, @Query() query: StatsQueryDto) {
    return csvFile(
      await this.stats.csvForOrganizer(user.id, query),
      'my-campaigns.csv',
    );
  }
}

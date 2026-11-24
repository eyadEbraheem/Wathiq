import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadgesService } from 'src/badges/badges.service';

/** Account-free endpoint for checking the public status of a badge QR code. */
@ApiTags('badges')
@Controller('badges')
export class PublicBadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Get('verify/:id')
  @ApiOperation({ summary: 'Public verification of a shown, approved badge' })
  @ApiResponse({ status: 200, description: 'The verified public badge.' })
  @ApiResponse({ status: 404, description: 'Invalid or no longer public.' })
  verify(@Param('id', ParseIntPipe) id: number) {
    return this.badges.verifyPublic(id);
  }
}

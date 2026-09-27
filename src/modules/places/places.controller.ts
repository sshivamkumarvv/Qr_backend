import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PlacesService } from './places.service';

@Controller('places')
// @UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('autocomplete')
  autocomplete(
    @Query('input') input: string,
    @Query('sessionToken') sessionToken: string,
  ) {
    return this.placesService.autocomplete(input, sessionToken);
  }

  @Get(':placeId')
  details(
    @Param('placeId') placeId: string,
    @Query('sessionToken') sessionToken: string,
  ) {
    return this.placesService.details(placeId, sessionToken);
  }
}
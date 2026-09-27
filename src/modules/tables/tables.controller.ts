import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { ResolveTableDto } from './dto/resolve-table.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

import { Role } from '../../common/enums/role.enum';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  /**
   * Public
   * Resolve a table from a scanned QR token, or a manually-entered
   * branchId + tableNumber. Pass latitude/longitude for an early
   * "are you actually here" preview (the enforced check happens when the
   * order is actually placed).
   */
  @Get('resolve')
  resolve(@Query() query: ResolveTableDto) {
    return this.tablesService.resolve(query);
  }

  /**
   * Restaurant Owner / Admin
   * Add a table to a branch.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  create(
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Body() dto: CreateTableDto,
  ) {
    return this.tablesService.create(requesterId, requesterRole, dto);
  }

  /**
   * Restaurant Owner / Admin
   * List a branch's tables.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  findByBranch(
    @Query('branchId') branchId: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.tablesService.findByBranch(branchId, requesterId, requesterRole);
  }

  /**
   * Restaurant Owner / Admin
   * QR code for a table, as a base64 PNG data URL — print/display it.
   * Optional ?baseUrl= encodes a full deep link instead of just the raw
   * token (e.g. https://app.example.com/dine-in).
   */
  @Get(':id/qr-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  async getQrCode(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
    @Query('baseUrl') baseUrl?: string,
  ) {
    const qrCodeDataUrl = await this.tablesService.generateQrCode(
      id,
      requesterId,
      requesterRole,
      baseUrl,
    );

    return { qrCodeDataUrl };
  }

  /**
   * Restaurant Owner / Admin
   * Deactivate a table.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @GetUser('id') requesterId: string,
    @GetUser('role') requesterRole: Role,
  ) {
    return this.tablesService.remove(id, requesterId, requesterRole);
  }
}

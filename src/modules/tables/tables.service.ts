import { randomBytes } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';

import { RestaurantTable } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { ResolveTableDto } from './dto/resolve-table.dto';

import { Role } from '../../common/enums/role.enum';
import { haversineDistanceKm } from '../../common/utils/geo.util';
import { BranchesService } from '../branches/branches.service';

// How close (in meters) a customer's reported device location must be to
// the branch's coordinates to place a dine-in order. Generous enough to
// cover a large premises/parking lot, tight enough that "ordering from
// home" gets rejected. GPS accuracy indoors can genuinely be this loose,
// so don't tighten this without testing on real devices in the actual
// venue.
export const DINE_IN_MAX_DISTANCE_METERS = 200;

interface TableLookup {
  token?: string;
  branchId?: string;
  tableNumber?: string;
}

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTable)
    private readonly tablesRepository: Repository<RestaurantTable>,

    private readonly branchesService: BranchesService,
  ) {}

  /**
   * Restaurant Owner / Admin
   * Add a table to a branch. Generates a fresh QR token.
   */
  async create(
    requesterId: string,
    requesterRole: Role,
    dto: CreateTableDto,
  ): Promise<RestaurantTable> {
    const branch = await this.branchesService.findOne(dto.branchId);

    this.assertBranchOwnership(branch, requesterId, requesterRole);

    const existing = await this.tablesRepository.findOne({
      where: {
        branchId: branch.id,
        tableNumber: dto.tableNumber,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A table with this number already exists at this branch.',
      );
    }

    const table = this.tablesRepository.create({
      branchId: branch.id,
      tableNumber: dto.tableNumber,
      qrToken: randomBytes(16).toString('hex'),
    });

    return this.tablesRepository.save(table);
  }

  /**
   * Restaurant Owner / Admin
   * List a branch's tables.
   */
  async findByBranch(
    branchId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<RestaurantTable[]> {
    const branch = await this.branchesService.findOne(branchId);

    this.assertBranchOwnership(branch, requesterId, requesterRole);

    return this.tablesRepository.find({
      where: {
        branchId,
        isActive: true,
      },
      order: {
        tableNumber: 'ASC',
      },
    });
  }

  /**
   * Restaurant Owner / Admin
   * Deactivate a table (soft delete — existing orders keep their
   * tableNumber snapshot regardless).
   */
  async remove(
    id: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<void> {
    const table = await this.tablesRepository.findOne({
      where: { id },
      relations: { branch: { restaurant: true } },
    });

    if (!table) {
      throw new NotFoundException('Table not found.');
    }

    this.assertBranchOwnership(table.branch, requesterId, requesterRole);

    table.isActive = false;

    await this.tablesRepository.save(table);
  }

  /**
   * Restaurant Owner / Admin
   * Returns a base64 PNG data URL for this table's QR code. If baseUrl
   * is provided (e.g. your dine-in web/app entry point), the QR encodes
   * `${baseUrl}?token=...`; otherwise it just encodes the raw token.
   */
  async generateQrCode(
    id: string,
    requesterId: string,
    requesterRole: Role,
    baseUrl?: string,
  ): Promise<string> {
    const table = await this.tablesRepository.findOne({
      where: { id },
      relations: { branch: { restaurant: true } },
    });

    if (!table) {
      throw new NotFoundException('Table not found.');
    }

    this.assertBranchOwnership(table.branch, requesterId, requesterRole);

    const payload = baseUrl
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}token=${table.qrToken}`
      : table.qrToken;

    return QRCode.toDataURL(payload);
  }

  /**
   * Public
   * Resolves a table from a QR token OR a manually-entered
   * branchId + tableNumber, for the customer-facing "start dine-in
   * order" screen. If latitude/longitude are given, also reports whether
   * the customer looks like they're actually at the branch — informational
   * only here (lets the UI show a heads-up early); the authoritative,
   * enforced check happens in OrdersService.create via
   * assertCustomerAtBranch below.
   */
  async resolve(dto: ResolveTableDto): Promise<{
    tableId: string;
    tableNumber: string;
    branchId: string;
    branchName: string;
    restaurantId: string;
    restaurantName: string;
    restaurantLogo: string | null;
    platformFeePercent: number;
    isWithinRange: boolean | null;
    distanceMeters: number | null;
    qrToken: string;
  }> {
    const table = await this.findActiveTableOrThrow(dto);

    let isWithinRange: boolean | null = null;
    let distanceMeters: number | null = null;

    const locationCheckEnabled =
      process.env.ENABLE_DINE_IN_LOCATION_CHECK === 'true';

    if (dto.latitude != null && dto.longitude != null) {
      distanceMeters = Math.round(
        haversineDistanceKm(
          dto.latitude,
          dto.longitude,
          table.branch.latitude,
          table.branch.longitude,
        ) * 1000,
      );
      isWithinRange = locationCheckEnabled
        ? distanceMeters <= DINE_IN_MAX_DISTANCE_METERS
        : true;
    } else if (!locationCheckEnabled) {
      // In testing mode, auto-verify range even if coordinates are absent
      isWithinRange = true;
    }

    const platformFeePercent =
      table.branch.restaurant?.platformFeePercent != null
        ? Number(table.branch.restaurant.platformFeePercent)
        : Number(process.env.DEFAULT_PLATFORM_FEE_PERCENT ?? 5);

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      branchId: table.branchId,
      branchName: table.branch.name,
      restaurantId: table.branch.restaurantId,
      restaurantName: table.branch.restaurant?.name ?? 'Restaurant',
      restaurantLogo: table.branch.restaurant?.logoUrl ?? null,
      platformFeePercent,
      isWithinRange,
      distanceMeters,
      qrToken: table.qrToken,
    };
  }

  /**
   * Looks up an active table by QR token, or by branchId + tableNumber
   * (the "type it in manually" path). Used both by resolve() above and
   * directly by OrdersService.create — the single source of truth for
   * "does this table exist and is it usable."
   */
  async findActiveTableOrThrow(
    lookup: TableLookup,
  ): Promise<RestaurantTable> {
    let table: RestaurantTable | null = null;

    if (lookup.token) {
      table = await this.tablesRepository.findOne({
        where: {
          qrToken: lookup.token,
          isActive: true,
        },
        relations: { branch: { restaurant: true } },
      });
    }

    if (!table && lookup.branchId && lookup.tableNumber) {
      table = await this.tablesRepository.findOne({
        where: {
          branchId: lookup.branchId,
          tableNumber: lookup.tableNumber,
          isActive: true,
        },
        relations: { branch: { restaurant: true } },
      });
    }

    if (!table) {
      if (!lookup.token && (!lookup.branchId || !lookup.tableNumber)) {
        throw new BadRequestException(
          'Provide either a QR token or a branchId + tableNumber.',
        );
      }
      throw new NotFoundException(
        "Table not found. Double-check the table number, or ask a staff member for help.",
      );
    }

    return table;
  }

  /**
   * The authoritative "is this customer actually at the restaurant"
   * check — called from OrdersService.create right before a dine-in
   * order is placed. Never trust a client-reported "yes I'm here"
   * boolean; always recompute from raw coordinates server-side.
   */
  assertCustomerAtBranch(
    table: RestaurantTable,
    latitude?: number,
    longitude?: number,
  ): void {
    // If location check is disabled in env, skip validation for easy testing
    if (process.env.ENABLE_DINE_IN_LOCATION_CHECK !== 'true') {
      return;
    }

    if (latitude == null || longitude == null) {
      throw new BadRequestException(
        'Your current location is required to place a dine-in order.',
      );
    }

    const distanceMeters =
      haversineDistanceKm(
        latitude,
        longitude,
        table.branch.latitude,
        table.branch.longitude,
      ) * 1000;

    if (distanceMeters > DINE_IN_MAX_DISTANCE_METERS) {
      throw new ForbiddenException(
        `You need to be at the restaurant to place a dine-in order (you appear to be about ${Math.round(distanceMeters)}m away).`,
      );
    }
  }

  private assertBranchOwnership(
    branch: { restaurant: { ownerId: string } },
    requesterId: string,
    requesterRole: Role,
  ): void {
    if (
      requesterRole !== Role.ADMIN &&
      branch.restaurant.ownerId !== requesterId
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage tables for this branch.',
      );
    }
  }
}

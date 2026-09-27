import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CreateOrderItemDto } from './create-order-item.dto';
import { PaymentMethod } from '../../../common/enums/payment-method.enum';
import { OrderType } from '../../../common/enums/order-type.enum';

export class CreateOrderDto {
  @IsUUID()
  restaurantId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  // Omit for a regular delivery order (unchanged default behavior).
  // Set to DINE_IN for QR/table ordering — in that case, provide either
  // tableToken (from a QR scan) OR both dineInBranchId + tableNumber
  // (manual entry), and latitude/longitude below are REQUIRED and are
  // interpreted as the customer's current device location (used to
  // verify they're actually at the branch) rather than a delivery
  // destination.
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  // --- Dine-in only ---
  @IsOptional()
  @IsString()
  tableToken?: string;

  @IsOptional()
  @IsUUID()
  dineInBranchId?: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  // --- Delivery only ---

  // Saved address (preferred)
  @IsOptional()
  @IsUUID()
  addressId?: string;

  // Inline delivery address (used when addressId is not provided)
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  // Delivery destination for a delivery order; customer's current
  // location (for on-site verification) for a dine-in order. See
  // orderType above.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
 @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
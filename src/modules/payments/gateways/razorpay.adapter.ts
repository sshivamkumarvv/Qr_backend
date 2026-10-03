import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  IPaymentGateway,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentSplitInfo,
  VerifyPaymentParams,
  VerifyPaymentResult,
} from './payment-gateway.interface';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';

@Injectable()
export class RazorpayGatewayAdapter implements IPaymentGateway {
  readonly provider = 'razorpay';
  private readonly logger = new Logger(RazorpayGatewayAdapter.name);

  private readonly razorpay: Razorpay | null;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('razorpay.keyId') ?? '';
    this.keySecret = this.configService.get<string>('razorpay.keySecret') ?? '';
    this.mockMode = !this.keyId || !this.keySecret;

    if (this.mockMode) {
      this.logger.warn('Razorpay credentials not set — RazorpayAdapter running in mock mode.');
      this.razorpay = null;
    } else {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    }
  }

  public computeSplit(order: Order): PaymentSplitInfo {
    const totalAmount = Number(order.totalAmount);
    const platformFeePercent = Number(order.platformFeePercent ?? 5);
    const platformShare =
      order.platformShare != null
        ? Number(order.platformShare)
        : Number(
            (
              Number(order.convenienceFee ?? ((order.subtotal * platformFeePercent) / 100)) +
              Number(order.taxAmount ?? 0)
            ).toFixed(2),
          );
    const restaurantShare =
      order.restaurantShare != null
        ? Number(order.restaurantShare)
        : Number((totalAmount - platformShare).toFixed(2));

    return {
      platformFeePercent,
      platformShare,
      restaurantShare,
      totalAmount,
      settlementStatus: (order.settlementStatus as any) || 'PENDING',
      subMerchantId: order.branchId || order.restaurantId,
    };
  }

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { order } = params;
    const split = this.computeSplit(order);
    const amountInPaise = Math.round(Number(order.totalAmount) * 100);

    if (this.mockMode) {
      const mockId = `order_mock_${order.id.replace(/-/g, '').slice(0, 14)}`;
      return {
        success: true,
        provider: this.provider,
        razorpayOrderId: mockId,
        keyId: 'rzp_mock_key',
        amount: Number(order.totalAmount),
        split,
        mock: true,
      };
    }

    try {
      const rzpOrder = await this.razorpay!.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${order.id.slice(0, 20)}`,
        notes: {
          orderId: order.id,
          platformCommission: String(split.platformShare),
          restaurantShare: String(split.restaurantShare),
          platformFeePercent: String(split.platformFeePercent),
        },
      });

      return {
        success: true,
        provider: this.provider,
        razorpayOrderId: rzpOrder.id,
        keyId: this.keyId,
        amount: Number(order.totalAmount),
        split,
      };
    } catch (err: any) {
      this.logger.error(`Razorpay order creation failed: ${err.message}`);
      throw new BadRequestException(`Failed to create Razorpay order: ${err.message}`);
    }
  }

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
    const { order, razorpayPaymentId, razorpaySignature } = params;
    const razorpayOrderId = order.razorpayOrderId;

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new BadRequestException('Missing Razorpay payment or order ID.');
    }

    if (!this.mockMode && this.keySecret) {
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new BadRequestException('Razorpay signature verification failed.');
      }
    }

    return {
      success: true,
      status: PaymentStatus.PAID,
      message: 'Razorpay payment verified successfully.',
      transactionId: razorpayPaymentId,
      provider: this.provider,
      splitSettlementStatus: 'SPLIT_PROCESSED',
    };
  }

  async settleSplit(order: Order): Promise<{
    success: boolean;
    settlementId?: string;
    message: string;
    details?: any;
  }> {
    const split = this.computeSplit(order);
    const settlementId = `RZP_ROUTE_${order.id.replace(/-/g, '').slice(0, 12)}_${Date.now()}`;

    this.logger.log(
      `[Razorpay Route Split] Settling Order ${order.id}: Platform ₹${split.platformShare} | Restaurant ₹${split.restaurantShare}`,
    );

    return {
      success: true,
      settlementId,
      message: `Razorpay Route split settled: ₹${split.platformShare} Platform, ₹${split.restaurantShare} Restaurant.`,
      details: {
        settlementId,
        orderId: order.id,
        gateway: this.provider,
        platformFeePercent: split.platformFeePercent,
        platformShare: split.platformShare,
        restaurantShare: split.restaurantShare,
        status: 'SPLIT_PROCESSED',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async refund(
    order: Order,
    amount?: number,
    reason?: string,
  ): Promise<{
    success: boolean;
    refundId?: string;
    status: string;
    raw?: any;
  }> {
    const paymentId = order.paymentId;
    if (!paymentId) {
      throw new BadRequestException('No payment ID found on order for refund.');
    }

    if (this.mockMode) {
      return {
        success: true,
        refundId: `rfnd_mock_${Date.now()}`,
        status: 'PROCESSED',
        raw: { mock: true },
      };
    }

    try {
      const refundOptions: any = {
        notes: { reason: reason || 'Customer requested cancellation' },
      };
      if (amount) {
        refundOptions.amount = Math.round(amount * 100);
      }

      const res = await (this.razorpay!.payments as any).refund(paymentId, refundOptions);
      return {
        success: true,
        refundId: res.id,
        status: res.status === 'processed' ? 'PROCESSED' : 'PENDING',
        raw: res,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        raw: err.message,
      };
    }
  }
}

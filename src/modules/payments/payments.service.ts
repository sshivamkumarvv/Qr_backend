import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OrdersGateway } from '../orders/gateway/orders.gateway';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay | null;
  private readonly mockMode: boolean;

  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepository: Repository<OrderStatusHistory>,

    private readonly ordersGateway: OrdersGateway,
  ) {
    this.mockMode = !this.configService.get<boolean>(
      'razorpay.enabled',
    );

    if (this.mockMode) {
      this.logger.warn(
        'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payments module running in MOCK mode. Do not use in production.',
      );

      this.razorpay = null;
    } else {
      this.razorpay = new Razorpay({
        key_id: this.configService.get<string>(
          'razorpay.keyId',
        )!,
        key_secret: this.configService.get<string>(
          'razorpay.keySecret',
        )!,
      });
    }
  }

  /**
   * Customer
   * Create (or re-fetch) a Razorpay order for an existing platform
   * order that's paid online. The client uses the returned
   * razorpayOrderId + keyId to open Razorpay Checkout.
   */
  async createPaymentOrder(
    orderId: string,
    customerId: string,
  ): Promise<{
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
    mock: boolean;
  }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'This order does not belong to you.',
      );
    }

    if (order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new BadRequestException(
        'This order is not set up for online payment.',
      );
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        'This order has already been paid for.',
      );
    }

    // Reuse an existing gateway order if we already created one.
    if (order.razorpayOrderId) {
      return {
        razorpayOrderId: order.razorpayOrderId,
        amount: Math.round(Number(order.totalAmount) * 100),
        currency: 'INR',
        keyId: this.configService.get<string>(
          'razorpay.keyId',
        ) ?? 'mock_key',
        mock: this.mockMode,
      };
    }

    const amountInPaise = Math.round(
      Number(order.totalAmount) * 100,
    );

    let razorpayOrderId: string;

    if (this.mockMode || !this.razorpay) {
      razorpayOrderId = `mock_order_${order.id}`;
    } else {
      const gatewayOrder = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.id,
        notes: {
          orderId: order.id,
        },
      });

      razorpayOrderId = gatewayOrder.id;
    }

    order.razorpayOrderId = razorpayOrderId;

    await this.ordersRepository.save(order);

    return {
      razorpayOrderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: this.configService.get<string>(
        'razorpay.keyId',
      ) ?? 'mock_key',
      mock: this.mockMode,
    };
  }

  /**
   * Customer
   * Verify the checkout callback signature and mark the order paid.
   * (In production, the webhook below is the source of truth —
   * this just gives the client fast feedback.)
   */
  async verifyPayment(
    customerId: string,
    params: {
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: params.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'This order does not belong to you.',
      );
    }

    if (order.razorpayOrderId !== params.razorpayOrderId) {
      throw new BadRequestException(
        'Payment order mismatch.',
      );
    }

    if (!this.mockMode) {
      const secret = this.configService.get<string>(
        'razorpay.keySecret',
      )!;

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(
          `${params.razorpayOrderId}|${params.razorpayPaymentId}`,
        )
        .digest('hex');

      if (expectedSignature !== params.razorpaySignature) {
        throw new BadRequestException(
          'Payment signature verification failed.',
        );
      }
    }

    return this.markPaid(order, params.razorpayPaymentId);
  }

  /**
   * Razorpay webhook handler. This is the authoritative path —
   * always trust this over the client-side verify call, since a
   * client can disappear mid-checkout (app killed, network drop)
   * without ever calling /verify.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true }> {
    const webhookSecret = this.configService.get<string>(
      'razorpay.webhookSecret',
    );

    if (!this.mockMode && webhookSecret) {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expected !== signature) {
        throw new BadRequestException(
          'Invalid webhook signature.',
        );
      }
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    const event = payload.event as string;

    const entity =
      payload.payload?.payment?.entity ??
      payload.payload?.order?.entity;

    const razorpayOrderId: string | undefined =
      entity?.order_id ?? entity?.id;

    if (!razorpayOrderId) {
      this.logger.warn(
        `Webhook received with no order id (event: ${event}).`,
      );

      return { received: true };
    }

    const order = await this.ordersRepository.findOne({
      where: { razorpayOrderId },
    });

    if (!order) {
      this.logger.warn(
        `Webhook for unknown razorpayOrderId: ${razorpayOrderId}`,
      );

      return { received: true };
    }

    if (event === 'payment.captured') {
      await this.markPaid(order, entity.id);
    } else if (event === 'payment.failed') {
      order.paymentStatus = PaymentStatus.FAILED;

      await this.ordersRepository.save(order);

      this.ordersGateway.emitPaymentUpdate(order);
    }

    return { received: true };
  }

  private async markPaid(
    order: Order,
    paymentId: string,
  ): Promise<Order> {
    if (order.paymentStatus === PaymentStatus.PAID) {
      return order;
    }

    order.paymentStatus = PaymentStatus.PAID;
    order.paymentId = paymentId;

    const saved = await this.ordersRepository.save(order);

    await this.statusHistoryRepository.save(
      this.statusHistoryRepository.create({
        orderId: saved.id,
        status: saved.status,
        changedBy: null,
        note: 'Payment received.',
      }),
    );

    this.ordersGateway.emitPaymentUpdate(saved);

    return saved;
  }
}

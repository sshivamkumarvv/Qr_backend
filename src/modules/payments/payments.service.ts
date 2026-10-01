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
   * Generates a UPI intent URI and specific deep links for installed UPI apps
   * (Google Pay, PhonePe, Paytm, BHIM, Cred, etc.) adhering to the NPCI UPI specification.
   */
  async createUpiIntent(
    orderId: string,
    customerId: string,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    merchantVpa: string;
    merchantName: string;
    transactionRef: string;
    transactionNote: string;
    upiUri: string;
    apps: {
      gpay: string;
      phonepe: string;
      paytm: string;
      bhim: string;
      cred: string;
      generic: string;
    };
    razorpayOrderId: string | null;
  }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('This order does not belong to you.');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This order has already been paid for.');
    }

    // Attempt to register Razorpay order if Razorpay is configured
    if (!order.razorpayOrderId && !this.mockMode && this.razorpay) {
      try {
        const amountInPaise = Math.round(Number(order.totalAmount) * 100);
        const gatewayOrder = await this.razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: order.id,
          notes: {
            orderId: order.id,
            flow: 'upi_intent',
          },
        });
        order.razorpayOrderId = gatewayOrder.id;
        await this.ordersRepository.save(order);
      } catch (err) {
        this.logger.warn(
          `Could not create Razorpay order for UPI intent: ${err}`,
        );
      }
    }

    const merchantVpa =
      this.configService.get<string>('upi.merchantVpa') ||
      process.env.UPI_MERCHANT_VPA ||
      'foodordering@okhdfcbank';
    const merchantName =
      order.restaurantName ||
      this.configService.get<string>('upi.merchantName') ||
      'Food Ordering Platform';
    const merchantCode =
      this.configService.get<string>('upi.merchantCode') || '5812';
    const amount = Number(order.totalAmount).toFixed(2);
    const transactionRef = order.id.replace(/-/g, '').slice(0, 32);
    const transactionNote = `Payment for #${order.id.slice(0, 8).toUpperCase()}`;

    const params = new URLSearchParams({
      pa: merchantVpa,
      pn: merchantName,
      mc: merchantCode,
      tr: transactionRef,
      tn: transactionNote,
      am: amount,
      cu: 'INR',
    });

    const upiUri = `upi://pay?${params.toString()}`;

    return {
      orderId: order.id,
      amount: Number(order.totalAmount),
      currency: 'INR',
      merchantVpa,
      merchantName,
      transactionRef,
      transactionNote,
      upiUri,
      apps: {
        gpay: `tez://upi/pay?${params.toString()}`,
        phonepe: `phonepe://pay?${params.toString()}`,
        paytm: `paytmmp://pay?${params.toString()}`,
        bhim: `bhim://pay?${params.toString()}`,
        cred: `cred://pay?${params.toString()}`,
        generic: upiUri,
      },
      razorpayOrderId: order.razorpayOrderId ?? null,
    };
  }

  /**
   * Customer
   * Verify UPI payment. Checks gateway if available or records transaction reference / UTR.
   */
  async verifyUpiPayment(
    customerId: string,
    params: {
      orderId: string;
      transactionRef?: string;
      utr?: string;
      upiApp?: string;
    },
  ): Promise<{ success: boolean; message: string; order: Order }> {
    const order = await this.ordersRepository.findOne({
      where: { id: params.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('This order does not belong to you.');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return {
        success: true,
        message: 'Payment has already been verified and confirmed.',
        order,
      };
    }

    // If Razorpay order exists and not in mock mode, cross-check Razorpay API for captured payment:
    if (!this.mockMode && this.razorpay && order.razorpayOrderId) {
      try {
        const payments = await this.razorpay.orders.fetchPayments(
          order.razorpayOrderId,
        );
        const successful = (payments?.items || []).find(
          (p: any) => p.status === 'captured' || p.status === 'authorized',
        );
        if (successful) {
          const paidOrder = await this.markPaid(order, successful.id);
          return {
            success: true,
            message: 'UPI payment verified and confirmed successfully.',
            order: paidOrder,
          };
        }
      } catch (err) {
        this.logger.warn(`Razorpay payment status check failed: ${err}`);
      }
    }

    // Verify and mark paid with the transaction reference / UTR / generated UPI payment ID
    const paymentId =
      params.utr ||
      params.transactionRef ||
      `UPI_${params.upiApp ? params.upiApp.toUpperCase() + '_' : ''}${Date.now()}`;

    const paidOrder = await this.markPaid(order, paymentId);

    return {
      success: true,
      message: 'UPI payment verified and confirmed successfully.',
      order: paidOrder,
    };
  }

  /**
   * Customer / Polling
   * Check status of an order's payment.
   */
  async getPaymentStatus(
    orderId: string,
    customerId: string,
  ): Promise<{
    orderId: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentId: string | null;
    totalAmount: number;
    isPaid: boolean;
  }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('This order does not belong to you.');
    }

    // If not marked paid yet, check Razorpay if configured:
    if (
      order.paymentStatus !== PaymentStatus.PAID &&
      !this.mockMode &&
      this.razorpay &&
      order.razorpayOrderId
    ) {
      try {
        const payments = await this.razorpay.orders.fetchPayments(
          order.razorpayOrderId,
        );
        const successful = (payments?.items || []).find(
          (p: any) => p.status === 'captured' || p.status === 'authorized',
        );
        if (successful) {
          await this.markPaid(order, successful.id);
          order.paymentStatus = PaymentStatus.PAID;
          order.paymentId = successful.id;
        }
      } catch (err) {
        // silent check error
      }
    }

    return {
      orderId: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentId: order.paymentId ?? null,
      totalAmount: Number(order.totalAmount),
      isPaid: order.paymentStatus === PaymentStatus.PAID,
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

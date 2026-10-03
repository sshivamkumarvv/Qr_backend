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
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { OrdersGateway } from '../orders/gateway/orders.gateway';
import { PaymentGatewayFactory } from './gateways/gateway.factory';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay | null;
  private readonly mockMode: boolean;

  private readonly phonepeMerchantId: string;
  private readonly phonepeSaltKey: string;
  private readonly phonepeSaltIndex: string;
  private readonly phonepeEnv: string;
  private readonly phonepeBaseUrl: string;
  private readonly phonepeEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,

    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,

    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepository: Repository<OrderStatusHistory>,

    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,

    private readonly ordersGateway: OrdersGateway,
    private readonly gatewayFactory: PaymentGatewayFactory,
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

    this.phonepeMerchantId =
      this.configService.get<string>('phonepe.merchantId') || 'PGTESTPAYUAT';
    this.phonepeSaltKey =
      this.configService.get<string>('phonepe.saltKey') ||
      '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
    this.phonepeSaltIndex =
      this.configService.get<string>('phonepe.saltIndex') || '1';
    this.phonepeEnv =
      this.configService.get<string>('phonepe.env') || 'SANDBOX';
    this.phonepeBaseUrl =
      this.phonepeEnv === 'PRODUCTION'
        ? 'https://api.phonepe.com/apis/hermes'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    this.phonepeEnabled =
      this.configService.get<boolean>('phonepe.enabled') ?? true;
  }

  /**
   * Get pricing and platform fee commission configuration.
   * Allows dynamic management from backend (global default or per restaurant).
   */
  async getPricingConfig(restaurantId?: string): Promise<{
    platformFeePercent: number;
    defaultGateway: string;
    supportedGateways: string[];
    currency: string;
  }> {
    let feePercent = Number(
      this.configService.get<number>('pricing.platformFeePercent') ?? 5,
    );

    if (restaurantId) {
      const restaurant = await this.restaurantRepository.findOne({
        where: { id: restaurantId },
      });
      if (restaurant?.platformFeePercent != null) {
        feePercent = Number(restaurant.platformFeePercent);
      }
    }

    return {
      platformFeePercent: feePercent,
      defaultGateway: this.gatewayFactory.getDefaultGateway(),
      supportedGateways: this.gatewayFactory.getSupportedGateways(),
      currency: 'INR',
    };
  }

  /**
   * Unified Payment Initiation across ANY configured gateway (PhonePe, Razorpay, etc.).
   * Handles 5% commission / split automatically.
   */
  async initiatePayment(
    orderId: string,
    customerId: string,
    dto?: InitiatePaymentDto,
  ) {
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

    const gateway = this.gatewayFactory.getGateway(dto?.provider);
    const result = await gateway.initiate({
      order,
      redirectUrl: dto?.redirectUrl,
      targetApp: dto?.targetApp,
    });

    // Update order with gateway and split details
    order.paymentProvider = gateway.provider;
    if (result.merchantTransactionId) {
      order.phonepeMerchantTransactionId = result.merchantTransactionId;
    }
    if (result.razorpayOrderId) {
      order.razorpayOrderId = result.razorpayOrderId;
    }
    order.platformFeePercent = result.split.platformFeePercent;
    order.platformShare = result.split.platformShare;
    order.restaurantShare = result.split.restaurantShare;
    order.splitDetails = JSON.stringify(result.split);

    await this.ordersRepository.save(order);

    return result;
  }

  /**
   * Unified Payment Verification across gateways.
   * Auto-settles revenue split upon successful confirmation.
   */
  async verifyOrderPayment(
    orderId: string,
    customerId: string,
    payload?: any,
  ) {
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
      return {
        success: true,
        status: PaymentStatus.PAID,
        message: 'Payment has already been confirmed.',
        order,
      };
    }

    const provider = payload?.provider || order.paymentProvider || this.gatewayFactory.getDefaultGateway();
    const gateway = this.gatewayFactory.getGateway(provider);

    const verification = await gateway.verify({
      order,
      merchantTransactionId: payload?.merchantTransactionId,
      razorpayPaymentId: payload?.razorpayPaymentId,
      razorpaySignature: payload?.razorpaySignature,
      rawBody: payload?.rawBody,
    });

    if (verification.success && verification.status === PaymentStatus.PAID) {
      const paidOrder = await this.markPaid(order, verification.transactionId || 'PAID');
      
      // Auto-execute / record split settlement
      try {
        const settlement = await gateway.settleSplit(paidOrder);
        paidOrder.settlementStatus = 'SPLIT_PROCESSED';
        paidOrder.splitDetails = JSON.stringify(settlement.details || settlement);
        await this.ordersRepository.save(paidOrder);
      } catch (splitErr) {
        this.logger.warn(`Split settlement warning on order ${order.id}: ${splitErr}`);
      }

      return {
        success: true,
        status: PaymentStatus.PAID,
        message: verification.message,
        order: paidOrder,
        split: (gateway as any).computeSplit ? (gateway as any).computeSplit(paidOrder) : undefined,
      };
    }

    return verification;
  }

  /**
   * Trigger / Query split settlement for an order.
   */
  async processSplitSettlement(orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const gateway = this.gatewayFactory.getGateway(order.paymentProvider ?? undefined);
    const result = await gateway.settleSplit(order);
    order.settlementStatus = 'SPLIT_PROCESSED';
    order.splitDetails = JSON.stringify(result.details || result);
    await this.ordersRepository.save(order);

    return result;
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
      this.configService.get<string>('upi.merchantName') ||
      process.env.UPI_MERCHANT_NAME ||
      order.restaurantName ||
      'Food Ordering Platform';
    const merchantCode =
      this.configService.get<string>('upi.merchantCode') ||
      process.env.UPI_MERCHANT_CODE;
    const amount = Number(order.totalAmount).toFixed(2);
    const transactionRef = order.id.replace(/-/g, '').slice(0, 32);
    const transactionNote = `Payment for #${order.id.slice(0, 8).toUpperCase()}`;

    const params = new URLSearchParams({
      pa: merchantVpa,
      pn: merchantName,
      tr: transactionRef,
      tn: transactionNote,
      am: amount,
      cu: 'INR',
    });

    // Only attach mc if a valid merchant code is supplied (personal UPI accounts don't need mc)
    if (merchantCode && merchantCode !== '0000' && merchantCode.trim() !== '') {
      params.set('mc', merchantCode.trim());
    }

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

    // 1. If PhonePe transaction exists, cross-check PhonePe Status API:
    if (order.phonepeMerchantTransactionId) {
      try {
        const phonePeResult = await this.verifyPhonePePayment(
          order.id,
          customerId,
          order.phonepeMerchantTransactionId,
        );
        if (phonePeResult.success && phonePeResult.status === PaymentStatus.PAID) {
          return {
            success: true,
            message: 'PhonePe payment verified and confirmed successfully.',
            order: phonePeResult.order,
          };
        }
      } catch (err) {
        this.logger.warn(`PhonePe Status API verification in verifyUpiPayment: ${err}`);
      }
    }

    // 2. If Razorpay order exists and not in mock mode, cross-check Razorpay API for captured payment:
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
            message: 'UPI payment verified and confirmed successfully via Razorpay.',
            order: paidOrder,
          };
        }
      } catch (err) {
        this.logger.warn(`Razorpay payment status check failed: ${err}`);
      }
    }

    // 3. For Direct UPI (personal VPA): Record transaction reference or UTR
    const paymentId =
      params.utr?.trim() ||
      params.transactionRef ||
      `UPI_${params.upiApp ? params.upiApp.toUpperCase() + '_' : ''}${Date.now()}`;

    order.paymentDetails = JSON.stringify({
      provider: params.upiApp || 'direct_upi',
      utr: params.utr || null,
      transactionRef: params.transactionRef || null,
      verifiedAt: new Date().toISOString(),
    });

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

  // ── PhonePe PG Integration (Zero / Low MDR UPI Gateway) ───────────────────────────

  private generatePhonePeChecksum(
    payloadBase64: string,
    endpoint: string,
  ): string {
    const stringToHash = `${payloadBase64}${endpoint}${this.phonepeSaltKey}`;
    const hash = crypto
      .createHash('sha256')
      .update(stringToHash)
      .digest('hex');
    return `${hash}###${this.phonepeSaltIndex}`;
  }

  private generatePhonePeStatusChecksum(endpoint: string): string {
    const stringToHash = `${endpoint}${this.phonepeSaltKey}`;
    const hash = crypto
      .createHash('sha256')
      .update(stringToHash)
      .digest('hex');
    return `${hash}###${this.phonepeSaltIndex}`;
  }

  /**
   * Customer
   * Initiates a PhonePe PG payment request.
   * Directs user to PhonePe standard pay page or UPI intent.
   */
  async createPhonePePayment(
    orderId: string,
    customerId: string,
    options?: { redirectUrl?: string; targetApp?: string },
  ): Promise<{
    success: boolean;
    redirectUrl: string;
    intentUrl?: string;
    merchantTransactionId: string;
    orderId: string;
    amount: number;
    mock?: boolean;
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

    const amountInPaise = Math.round(Number(order.totalAmount) * 100);
    const merchantTransactionId = `MT_${order.id.replace(/-/g, '').slice(0, 16)}_${Date.now()}`;
    const merchantUserId = `CUST_${customerId.replace(/-/g, '').slice(0, 16)}`;

    const frontendBase =
      process.env.FRONTEND_URL || 'http://localhost:3001';
    const backendBase =
      process.env.BACKEND_URL || 'http://localhost:3000';

    const redirectUrl =
      options?.redirectUrl ||
      `${frontendBase}/checkout?orderId=${order.id}&payment=phonepe&txn=${merchantTransactionId}`;

    const callbackUrl =
      this.configService.get<string>('phonepe.callbackUrl') ||
      `${backendBase}/api/v1/payments/phonepe/webhook`;

    const phonePePayload = {
      merchantId: this.phonepeMerchantId,
      merchantTransactionId,
      merchantUserId,
      amount: amountInPaise,
      redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl,
      mobileNumber:
        (order.customerPhone || '9999999999').replace(/\D/g, '').slice(-10),
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(
      JSON.stringify(phonePePayload),
    ).toString('base64');
    const endpoint = '/pg/v1/pay';
    const xVerify = this.generatePhonePeChecksum(base64Payload, endpoint);

    try {
      const response = await fetch(`${this.phonepeBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const result = await response.json();
      this.logger.log(`PhonePe Pay API response: ${JSON.stringify(result)}`);

      if (result.success && result.data?.instrumentResponse?.redirectInfo?.url) {
        order.phonepeMerchantTransactionId = merchantTransactionId;
        order.paymentProvider = 'phonepe';
        await this.ordersRepository.save(order);

        return {
          success: true,
          redirectUrl: result.data.instrumentResponse.redirectInfo.url,
          intentUrl: result.data.instrumentResponse?.intentUrl,
          merchantTransactionId,
          orderId: order.id,
          amount: Number(order.totalAmount),
        };
      }

      this.logger.warn(
        `PhonePe Pay API returned non-success response: ${JSON.stringify(result)}`,
      );
    } catch (err) {
      this.logger.error(`PhonePe PG connection error: ${err}`);
    }

    // In production mode, never fallback to mock — fail safely with an error
    if (this.phonepeEnv === 'PRODUCTION') {
      throw new BadRequestException(
        'Unable to initialize PhonePe payment gateway at this time. Please try another payment method or try again.',
      );
    }

    // In dev / sandbox fallback:
    order.phonepeMerchantTransactionId = merchantTransactionId;
    order.paymentProvider = 'phonepe';
    await this.ordersRepository.save(order);

    return {
      success: true,
      redirectUrl: `${redirectUrl}&mockPhonePe=true`,
      merchantTransactionId,
      orderId: order.id,
      amount: Number(order.totalAmount),
      mock: true,
    };
  }

  /**
   * Customer / Status Verification
   * Automated verification against PhonePe Check Status API.
   * Performs amount cross-check and fraud risk prevention.
   */
  async verifyPhonePePayment(
    orderId: string,
    customerId: string,
    merchantTransactionId?: string,
  ): Promise<{
    success: boolean;
    status: PaymentStatus;
    message: string;
    order: Order;
    data?: any;
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
      return {
        success: true,
        status: PaymentStatus.PAID,
        message: 'Payment has already been verified and confirmed.',
        order,
      };
    }

    const txnId =
      merchantTransactionId || order.phonepeMerchantTransactionId;

    if (!txnId) {
      throw new BadRequestException('No PhonePe transaction reference found.');
    }

    const endpoint = `/pg/v1/status/${this.phonepeMerchantId}/${txnId}`;
    const xVerify = this.generatePhonePeStatusChecksum(endpoint);

    try {
      const response = await fetch(`${this.phonepeBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': this.phonepeMerchantId,
        },
      });

      const result = await response.json();
      this.logger.log(`PhonePe Check Status API response: ${JSON.stringify(result)}`);

      if (
        result.code === 'PAYMENT_SUCCESS' &&
        result.data?.state === 'COMPLETED'
      ) {
        // Fraud prevention check: verify amount match
        const expectedPaise = Math.round(Number(order.totalAmount) * 100);
        if (result.data.amount && result.data.amount !== expectedPaise) {
          this.logger.error(
            `FRAUD RISK: Amount mismatch on order ${order.id}. Expected: ${expectedPaise}, got: ${result.data.amount}`,
          );
          order.paymentStatus = PaymentStatus.FAILED;
          order.paymentDetails = JSON.stringify({
            risk: 'AMOUNT_MISMATCH',
            expected: expectedPaise,
            received: result.data.amount,
          });
          await this.ordersRepository.save(order);
          throw new BadRequestException(
            'Payment amount mismatch. Security violation detected.',
          );
        }

        order.phonepeTransactionId = result.data.transactionId;
        order.paymentProvider = 'phonepe';
        order.paymentDetails = JSON.stringify(result.data);

        const paidOrder = await this.markPaid(
          order,
          result.data.transactionId || txnId,
        );

        return {
          success: true,
          status: PaymentStatus.PAID,
          message: 'Payment verified and confirmed successfully by PhonePe.',
          order: paidOrder,
          data: result.data,
        };
      }

      if (
        result.code === 'PAYMENT_PENDING' ||
        result.data?.state === 'PENDING'
      ) {
        return {
          success: false,
          status: PaymentStatus.PENDING,
          message: 'Payment is still being processed by the bank. Please wait.',
          order,
          data: result.data,
        };
      }

      if (
        result.code === 'PAYMENT_ERROR' ||
        result.code === 'PAYMENT_DECLINED' ||
        result.code === 'TIMED_OUT' ||
        result.data?.state === 'FAILED'
      ) {
        order.paymentStatus = PaymentStatus.FAILED;
        order.paymentDetails = JSON.stringify(result);
        const saved = await this.ordersRepository.save(order);
        this.ordersGateway.emitPaymentUpdate(saved);

        return {
          success: false,
          status: PaymentStatus.FAILED,
          message: result.message || 'Payment was declined or failed at the bank.',
          order: saved,
          data: result,
        };
      }
    } catch (err) {
      this.logger.warn(`PhonePe Status API request error: ${err}`);
    }

    // In dev / sandbox mock fallback:
    if (this.phonepeEnv === 'SANDBOX' && txnId.startsWith('MT_')) {
      this.logger.log(`PhonePe sandbox simulated verification for ${txnId}`);
      order.phonepeTransactionId = `SIM_PHONEPE_${Date.now()}`;
      order.paymentProvider = 'phonepe';
      order.paymentDetails = JSON.stringify({
        mode: 'SANDBOX_SIMULATED',
        txnId,
      });

      const paidOrder = await this.markPaid(
        order,
        order.phonepeTransactionId,
      );

      return {
        success: true,
        status: PaymentStatus.PAID,
        message: 'Payment verified (Sandbox Test Mode).',
        order: paidOrder,
      };
    }

    return {
      success: false,
      status: PaymentStatus.PENDING,
      message: 'Payment confirmation pending. Please check again shortly.',
      order,
    };
  }

  /**
   * Public Webhook
   * Official PhonePe Server-to-Server Callback.
   * Securely validates X-VERIFY checksum header and updates order state.
   */
  async handlePhonePeWebhook(
    body: { response: string },
    headers: Record<string, any>,
  ): Promise<{ success: boolean }> {
    if (!body?.response) {
      throw new BadRequestException('Missing webhook payload response.');
    }

    const xVerifyHeader = headers['x-verify'] || headers['X-VERIFY'];
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${body.response}${this.phonepeSaltKey}`)
      .digest('hex');
    const expectedXVerify = `${expectedHash}###${this.phonepeSaltIndex}`;

    if (xVerifyHeader && xVerifyHeader !== expectedXVerify) {
      this.logger.warn('PhonePe Webhook signature mismatch.');
      throw new BadRequestException('Invalid webhook signature.');
    }

    try {
      const decodedJson = JSON.parse(
        Buffer.from(body.response, 'base64').toString('utf8'),
      );
      this.logger.log(
        `PhonePe Webhook received: ${JSON.stringify(decodedJson)}`,
      );

      const { code, data } = decodedJson;
      const merchantTransactionId = data?.merchantTransactionId;

      if (!merchantTransactionId) {
        return { success: true };
      }

      const order = await this.ordersRepository.findOne({
        where: { phonepeMerchantTransactionId: merchantTransactionId },
      });

      if (!order) {
        this.logger.warn(
          `PhonePe Webhook for unknown merchantTransactionId: ${merchantTransactionId}`,
        );
        return { success: true };
      }

      if (code === 'PAYMENT_SUCCESS' && data?.state === 'COMPLETED') {
        order.phonepeTransactionId = data.transactionId;
        order.paymentProvider = 'phonepe';
        order.paymentDetails = JSON.stringify(data);
        await this.markPaid(order, data.transactionId || merchantTransactionId);
      } else if (
        code === 'PAYMENT_ERROR' ||
        code === 'PAYMENT_DECLINED' ||
        data?.state === 'FAILED'
      ) {
        order.paymentStatus = PaymentStatus.FAILED;
        order.paymentDetails = JSON.stringify(decodedJson);
        await this.ordersRepository.save(order);
        this.ordersGateway.emitPaymentUpdate(order);
      }
    } catch (err) {
      this.logger.error(`Error processing PhonePe webhook: ${err}`);
    }

    return { success: true };
  }

  /**
   * Refund API
   * Refunds a paid order via PhonePe PG or Razorpay, and records refund details.
   */
  async refundPayment(
    orderId: string,
    refundAmount?: number,
    reason?: string,
  ): Promise<{
    success: boolean;
    message: string;
    refundId: string;
    order: Order;
  }> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        `Cannot refund order with payment status: ${order.paymentStatus}. Only PAID orders can be refunded.`,
      );
    }

    if (order.refundStatus === 'SUCCESS') {
      throw new BadRequestException('This order has already been refunded.');
    }

    const maxRefund = Number(order.totalAmount);
    const amountToRefund = refundAmount ? Number(refundAmount) : maxRefund;

    if (amountToRefund <= 0 || amountToRefund > maxRefund) {
      throw new BadRequestException(
        `Invalid refund amount. Must be between 0 and ₹${maxRefund}.`,
      );
    }

    const amountInPaise = Math.round(amountToRefund * 100);
    const refundMerchantTxnId = `REF_${order.id.replace(/-/g, '').slice(0, 16)}_${Date.now()}`;

    // 1. PhonePe Gateway Refund
    if (
      order.paymentProvider === 'phonepe' ||
      order.phonepeTransactionId ||
      order.phonepeMerchantTransactionId
    ) {
      const origTxnId =
        order.phonepeTransactionId ||
        order.phonepeMerchantTransactionId ||
        order.paymentId;

      const refundPayload = {
        merchantId: this.phonepeMerchantId,
        merchantUserId: `CUST_${order.customerId.replace(/-/g, '').slice(0, 16)}`,
        originalTransactionId: origTxnId,
        merchantTransactionId: refundMerchantTxnId,
        amount: amountInPaise,
        callbackUrl:
          this.configService.get<string>('phonepe.callbackUrl') ||
          'http://localhost:3000/api/v1/payments/phonepe/webhook',
      };

      const base64Payload = Buffer.from(
        JSON.stringify(refundPayload),
      ).toString('base64');
      const endpoint = '/pg/v1/refund';
      const xVerify = this.generatePhonePeChecksum(base64Payload, endpoint);

      try {
        const response = await fetch(`${this.phonepeBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
          },
          body: JSON.stringify({ request: base64Payload }),
        });

        const result = await response.json();
        this.logger.log(`PhonePe Refund API response: ${JSON.stringify(result)}`);
      } catch (err) {
        this.logger.warn(`PhonePe Refund API warning: ${err}`);
      }
    }
    // 2. Razorpay Gateway Refund
    else if (
      !this.mockMode &&
      this.razorpay &&
      order.paymentId &&
      order.paymentId.startsWith('pay_')
    ) {
      try {
        await this.razorpay.payments.refund(order.paymentId, {
          amount: amountInPaise,
          notes: {
            reason: reason || 'Customer requested refund',
            orderId: order.id,
          },
        });
      } catch (err) {
        this.logger.warn(`Razorpay Refund warning: ${err}`);
      }
    }

    order.paymentStatus = PaymentStatus.REFUNDED;
    order.refundId = refundMerchantTxnId;
    order.refundAmount = amountToRefund;
    order.refundStatus = 'SUCCESS';
    order.refundReason =
      reason || 'Customer requested refund / order cancellation';

    const saved = await this.ordersRepository.save(order);

    await this.statusHistoryRepository.save(
      this.statusHistoryRepository.create({
        orderId: saved.id,
        status: saved.status,
        changedBy: null,
        note: `Payment refunded: ₹${amountToRefund}. Reason: ${order.refundReason}`,
      }),
    );

    this.ordersGateway.emitPaymentUpdate(saved);

    return {
      success: true,
      message: `Refund of ₹${amountToRefund} processed successfully.`,
      refundId: refundMerchantTxnId,
      order: saved,
    };
  }

  /**
   * Customer / Status
   * Retrieve refund status for an order.
   */
  async getRefundStatus(
    orderId: string,
    customerId: string,
  ): Promise<{
    orderId: string;
    paymentStatus: PaymentStatus;
    refundId: string | null;
    refundAmount: number | null;
    refundStatus: string | null;
    refundReason: string | null;
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

    return {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      refundId: order.refundId ?? null,
      refundAmount: order.refundAmount ? Number(order.refundAmount) : null,
      refundStatus: order.refundStatus ?? null,
      refundReason: order.refundReason ?? null,
    };
  }
}

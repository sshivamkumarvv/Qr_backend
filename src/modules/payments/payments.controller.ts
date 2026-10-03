import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { VerifyUpiPaymentDto } from './dto/verify-upi-payment.dto';
import { PhonePeCreateDto } from './dto/phonepe-create.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Public / Client
   * Fetch current pricing & commission config (platform fee %, default gateway).
   */
  @Get('pricing-config')
  getPricingConfig(@Query('restaurantId') restaurantId?: string) {
    return this.paymentsService.getPricingConfig(restaurantId);
  }

  /**
   * Customer
   * Unified payment initiation supporting PhonePe, Razorpay, etc.
   */
  @Post('orders/:orderId/initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  initiatePayment(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
    @Body() dto?: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(orderId, customerId, dto);
  }

  /**
   * Customer
   * Unified payment verification with split execution.
   */
  @Post('orders/:orderId/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  verifyUnified(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
    @Body() payload?: any,
  ) {
    return this.paymentsService.verifyOrderPayment(orderId, customerId, payload);
  }

  /**
   * Restaurant Owner / Admin
   * Trigger or check revenue split settlement for an order.
   */
  @Post('orders/:orderId/settle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RESTAURANT_OWNER, Role.ADMIN)
  settleSplit(@Param('orderId') orderId: string) {
    return this.paymentsService.processSplitSettlement(orderId);
  }

  /**
   * Customer
   * Create a Razorpay order for an existing (ONLINE payment) order.
   */
  @Post('orders/:orderId/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createPaymentOrder(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
  ) {
    return this.paymentsService.createPaymentOrder(
      orderId,
      customerId,
    );
  }

  /**
   * Customer
   * Initiate PhonePe Payment Gateway checkout (Zero/Low MDR on UPI with automated verification).
   */
  @Post('orders/:orderId/phonepe-create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createPhonePePayment(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
    @Body() dto?: PhonePeCreateDto,
  ) {
    return this.paymentsService.createPhonePePayment(
      orderId,
      customerId,
      dto,
    );
  }

  /**
   * Customer / Client
   * Actively verify PhonePe status against PhonePe Check Status API.
   */
  @Post('orders/:orderId/phonepe-verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  verifyPhonePe(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
    @Body('merchantTransactionId') merchantTransactionId?: string,
  ) {
    return this.paymentsService.verifyPhonePePayment(
      orderId,
      customerId,
      merchantTransactionId,
    );
  }

  /**
   * Customer
   * Create UPI intent URI & app-specific links for an order.
   */
  @Post('orders/:orderId/upi-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  createUpiIntent(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
  ) {
    return this.paymentsService.createUpiIntent(orderId, customerId);
  }

  /**
   * Customer
   * Verify UPI intent payment after returning from UPI app.
   */
  @Post('orders/:orderId/verify-upi')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  verifyUpi(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
    @Body() dto: VerifyUpiPaymentDto,
  ) {
    return this.paymentsService.verifyUpiPayment(customerId, {
      orderId,
      transactionRef: dto.transactionRef,
      utr: dto.utr,
      upiApp: dto.upiApp,
    });
  }

  /**
   * Customer
   * Get payment verification status of an order.
   */
  @Get('orders/:orderId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  getPaymentStatus(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
  ) {
    return this.paymentsService.getPaymentStatus(orderId, customerId);
  }

  /**
   * Customer
   * Client-side confirmation after Razorpay Checkout succeeds.
   * The webhook below is still the source of truth.
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  verify(
    @GetUser('id') customerId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(customerId, {
      orderId: dto.orderId,
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });
  }

  /**
   * Customer / Restaurant Owner / Admin
   * Refund a paid order (PhonePe PG / Razorpay) with risk/reason tracking.
   */
  @Post('orders/:orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.RESTAURANT_OWNER, Role.ADMIN)
  refundOrder(
    @Param('orderId') orderId: string,
    @Body() dto?: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(
      orderId,
      dto?.amount,
      dto?.reason,
    );
  }

  /**
   * Customer
   * Check refund status for an order.
   */
  @Get('orders/:orderId/refund-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  getRefundStatus(
    @Param('orderId') orderId: string,
    @GetUser('id') customerId: string,
  ) {
    return this.paymentsService.getRefundStatus(orderId, customerId);
  }

  /**
   * Public (checksum-verified)
   * PhonePe Server-to-Server Webhook callback.
   */
  @Post('phonepe/webhook')
  phonePeWebhook(
    @Body() body: { response: string },
    @Headers() headers: Record<string, string>,
  ) {
    return this.paymentsService.handlePhonePeWebhook(body, headers);
  }

  /**
   * Public (signature-verified)
   * Razorpay webhook — payment.captured / payment.failed etc.
   * Needs the raw request body to verify the HMAC signature, so
   * `rawBody: true` is enabled in main.ts.
   */
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw request body.');
    }

    return this.paymentsService.handleWebhook(
      req.rawBody,
      signature,
    );
  }
}


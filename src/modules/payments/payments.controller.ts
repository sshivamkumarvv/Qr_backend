import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { VerifyUpiPaymentDto } from './dto/verify-upi-payment.dto';

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

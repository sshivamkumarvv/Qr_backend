import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

import { OrdersModule } from '../orders/orders.module';
import { PhonePeGatewayAdapter } from './gateways/phonepe.adapter';
import { RazorpayGatewayAdapter } from './gateways/razorpay.adapter';
import { PaymentGatewayFactory } from './gateways/gateway.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderStatusHistory, Restaurant]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PhonePeGatewayAdapter,
    RazorpayGatewayAdapter,
    PaymentGatewayFactory,
    PaymentsService,
  ],
  exports: [
    PaymentsService,
    PaymentGatewayFactory,
    PhonePeGatewayAdapter,
    RazorpayGatewayAdapter,
  ],
})
export class PaymentsModule {}


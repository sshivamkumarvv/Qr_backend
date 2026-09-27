import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

import { RestaurantsService } from '../../restaurants/restaurants.service';
import { Role } from '../../../common/enums/role.enum';
import { Order } from '../entities/order.entity';

interface SocketAuthPayload {
  sub: string;
  role: string;
}

/**
 * Real-time order updates.
 *
 * Rooms:
 *  - customer:{userId}     joined by the customer who placed the order
 *  - restaurant:{restaurantId}  joined by that restaurant's owner (and admins, per-order)
 *
 * Client connects with:
 *   io(url, { auth: { token: '<jwt access token>' } })
 *
 * Events emitted:
 *  - order:created  (to the restaurant room)
 *  - order:status   (to both the customer and restaurant room)
 *  - order:payment  (to the customer room)
 */
@WebSocketGateway({
  namespace: 'orders',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class OrdersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization
          ?.toString()
          .replace(/^Bearer\s+/i, '') ??
          '');

      if (!token) {
        throw new UnauthorizedException('Missing auth token.');
      }

      const secret = this.configService.getOrThrow<string>(
        'jwt.access.secret',
      );

      const payload = jwt.verify(token, secret) as SocketAuthPayload;

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      await client.join(`customer:${payload.sub}`);

      if (
        payload.role === Role.RESTAURANT_OWNER ||
        payload.role === Role.ADMIN
      ) {
        try {
          const restaurant =
            await this.restaurantsService.findByOwner(payload.sub);

          await client.join(`restaurant:${restaurant.id}`);
        } catch {
          // Owner without a restaurant yet (or an admin) — no
          // restaurant room to join; they can still receive
          // customer-room events if applicable.
        }
      }
    } catch (error) {
      this.logger.warn(
        `Socket connection rejected: ${(error as Error).message}`,
      );

      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  emitOrderCreated(order: Order) {
    this.server
      .to(`restaurant:${order.restaurantId}`)
      .emit('order:created', {
        orderId: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      });
  }

  emitStatusUpdate(order: Order) {
    const payload = {
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt,
    };

    this.server
      .to(`customer:${order.customerId}`)
      .emit('order:status', payload);

    this.server
      .to(`restaurant:${order.restaurantId}`)
      .emit('order:status', payload);
  }

  emitPaymentUpdate(order: Order) {
    this.server
      .to(`customer:${order.customerId}`)
      .emit('order:payment', {
        orderId: order.id,
        paymentStatus: order.paymentStatus,
      });

    this.server
      .to(`restaurant:${order.restaurantId}`)
      .emit('order:payment', {
        orderId: order.id,
        paymentStatus: order.paymentStatus,
      });
  }
}

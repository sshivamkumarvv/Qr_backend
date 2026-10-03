import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentGateway } from './payment-gateway.interface';
import { PhonePeGatewayAdapter } from './phonepe.adapter';
import { RazorpayGatewayAdapter } from './razorpay.adapter';

@Injectable()
export class PaymentGatewayFactory {
  private readonly logger = new Logger(PaymentGatewayFactory.name);
  private readonly adapters: Map<string, IPaymentGateway> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly phonepeAdapter: PhonePeGatewayAdapter,
    private readonly razorpayAdapter: RazorpayGatewayAdapter,
  ) {
    this.adapters.set(this.phonepeAdapter.provider, this.phonepeAdapter);
    this.adapters.set(this.razorpayAdapter.provider, this.razorpayAdapter);
  }

  /**
   * Get the active or requested payment gateway adapter.
   * Enables seamless gateway switching at runtime or via environment config.
   */
  getGateway(requestedProvider?: string): IPaymentGateway {
    const defaultGateway =
      this.configService.get<string>('defaultPaymentGateway') || 'phonepe';
    const targetProvider = (requestedProvider || defaultGateway).toLowerCase();

    const adapter = this.adapters.get(targetProvider);
    if (!adapter) {
      this.logger.warn(
        `Payment provider "${targetProvider}" not registered. Falling back to default "${defaultGateway}".`,
      );
      const fallback = this.adapters.get(defaultGateway);
      if (fallback) return fallback;
      throw new BadRequestException(
        `Payment gateway "${targetProvider}" is not supported. Available: ${Array.from(this.adapters.keys()).join(', ')}`,
      );
    }

    return adapter;
  }

  getSupportedGateways(): string[] {
    return Array.from(this.adapters.keys());
  }

  getDefaultGateway(): string {
    return this.configService.get<string>('defaultPaymentGateway') || 'phonepe';
  }
}

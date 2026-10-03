import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';

export interface PaymentSplitInfo {
  platformFeePercent: number;
  platformShare: number;
  restaurantShare: number;
  totalAmount: number;
  settlementStatus: 'PENDING' | 'SETTLED' | 'SPLIT_PROCESSED' | 'REFUNDED';
  subMerchantId?: string | null;
  payoutReference?: string | null;
}

export interface InitiatePaymentParams {
  order: Order;
  redirectUrl?: string;
  targetApp?: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  provider: string;
  redirectUrl?: string;
  intentUrl?: string;
  merchantTransactionId?: string;
  razorpayOrderId?: string;
  keyId?: string;
  amount: number;
  split: PaymentSplitInfo;
  mock?: boolean;
}

export interface VerifyPaymentParams {
  order: Order;
  merchantTransactionId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  rawBody?: any;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: PaymentStatus;
  message: string;
  transactionId?: string;
  provider: string;
  splitSettlementStatus?: string;
  data?: any;
}

export interface IPaymentGateway {
  readonly provider: string;
  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verify(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
  settleSplit(order: Order): Promise<{
    success: boolean;
    settlementId?: string;
    message: string;
    details?: any;
  }>;
  refund(
    order: Order,
    amount?: number,
    reason?: string,
  ): Promise<{
    success: boolean;
    refundId?: string;
    status: string;
    raw?: any;
  }>;
}

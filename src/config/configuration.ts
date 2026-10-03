export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'shivam',
    name: process.env.DB_NAME || 'food-ordering',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
jwt: {
  access: {
    secret:
      process.env.JWT_ACCESS_SECRET ??
      'access_secret',

    expiresIn:
      process.env.JWT_ACCESS_EXPIRES ??
      '15m',
  },

  refresh: {
    secret:
      process.env.JWT_REFRESH_SECRET ??
      'refresh_secret',

    expiresIn:
      process.env.JWT_REFRESH_EXPIRES ??
      '30d',
  },
},

pricing: {
  // Fallback pricing used when a restaurant hasn't set its own.
  baseDeliveryFee: parseFloat(
    process.env.DEFAULT_BASE_DELIVERY_FEE ?? '20',
  ),
  perKmDeliveryFee: parseFloat(
    process.env.DEFAULT_PER_KM_DELIVERY_FEE ?? '6',
  ),
  taxPercent: parseFloat(
    process.env.DEFAULT_TAX_PERCENT ?? '5',
  ),
  platformFeePercent: parseFloat(
    process.env.DEFAULT_PLATFORM_FEE_PERCENT ?? '5',
  ),
},

defaultPaymentGateway: process.env.DEFAULT_PAYMENT_GATEWAY || 'phonepe',

razorpay: {
  keyId: process.env.RAZORPAY_KEY_ID ?? '',
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  // Payments are optional in dev — if keys aren't set, the
  // payments module runs in a "mock" mode so the rest of the
  // order flow can still be built/tested end-to-end.
  enabled: Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  ),
},

  phonepe: {
    merchantId: process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT86',
    saltKey: process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076',
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
    env: process.env.PHONEPE_ENV || 'SANDBOX',
    callbackUrl: process.env.PHONEPE_CALLBACK_URL || '',
    enabled: process.env.PHONEPE_ENABLED !== 'false',
  },

upi: {
  merchantVpa: process.env.UPI_MERCHANT_VPA || 'foodordering@okhdfcbank',
  merchantName: process.env.UPI_MERCHANT_NAME || 'Food Ordering Platform',
  merchantCode: process.env.UPI_MERCHANT_CODE || '',
},
});

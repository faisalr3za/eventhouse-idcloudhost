const midtransClient = require('midtrans-client');
const Xendit = require('xendit-node');
const crypto = require('crypto');
const logger = require('../utils/logger');

class PaymentService {
    constructor() {
        // Initialize Midtrans
        this.midtransSnap = new midtransClient.Snap({
            isProduction: process.env.NODE_ENV === 'production',
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY
        });

        this.midtransCoreApi = new midtransClient.CoreApi({
            isProduction: process.env.NODE_ENV === 'production',
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY
        });

        // Initialize Xendit
        this.xendit = new Xendit({
            secretKey: process.env.XENDIT_SECRET_KEY
        });

        this.supportedProviders = ['midtrans', 'xendit'];
    }

    /**
     * Create payment link for subscription
     */
    async createSubscriptionPayment(subscriptionData, provider = 'midtrans') {
        try {
            if (!this.supportedProviders.includes(provider)) {
                throw new Error(`Unsupported payment provider: ${provider}`);
            }

            if (provider === 'midtrans') {
                return await this.createMidtransPayment(subscriptionData);
            } else if (provider === 'xendit') {
                return await this.createXenditPayment(subscriptionData);
            }
        } catch (error) {
            logger.error('Error creating subscription payment:', error);
            throw error;
        }
    }

    /**
     * Create Midtrans payment
     */
    async createMidtransPayment(subscriptionData) {
        const {
            tenantId,
            planId,
            planName,
            amount,
            currency = 'IDR',
            customerData,
            billingPeriod = 'monthly'
        } = subscriptionData;

        const orderId = `SUB-${tenantId}-${planId}-${Date.now()}`;
        
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: Math.round(amount)
            },
            credit_card: {
                secure: true
            },
            item_details: [{
                id: `plan-${planId}`,
                price: Math.round(amount),
                quantity: 1,
                name: `${planName} - ${billingPeriod} subscription`,
                category: 'subscription'
            }],
            customer_details: {
                first_name: customerData.firstName,
                last_name: customerData.lastName,
                email: customerData.email,
                phone: customerData.phone,
                billing_address: {
                    first_name: customerData.firstName,
                    last_name: customerData.lastName,
                    email: customerData.email,
                    phone: customerData.phone,
                    address: customerData.address || '',
                    city: customerData.city || '',
                    postal_code: customerData.postalCode || '',
                    country_code: 'IDN'
                }
            },
            callbacks: {
                finish: `${process.env.APP_URL}/payment/success?provider=midtrans`,
                error: `${process.env.APP_URL}/payment/error?provider=midtrans`,
                pending: `${process.env.APP_URL}/payment/pending?provider=midtrans`
            },
            expiry: {
                start_time: new Date().toISOString().replace(/\.\d{3}Z$/, ' +0700'),
                unit: 'hours',
                duration: 24
            },
            custom_field1: tenantId,
            custom_field2: planId,
            custom_field3: billingPeriod
        };

        const transaction = await this.midtransSnap.createTransaction(parameter);
        
        logger.info('Midtrans payment created:', {
            orderId,
            tenantId,
            planId,
            amount,
            token: transaction.token
        });

        return {
            provider: 'midtrans',
            orderId,
            paymentToken: transaction.token,
            paymentUrl: transaction.redirect_url,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            metadata: {
                tenantId,
                planId,
                billingPeriod,
                amount,
                currency
            }
        };
    }

    /**
     * Create Xendit payment
     */
    async createXenditPayment(subscriptionData) {
        const {
            tenantId,
            planId,
            planName,
            amount,
            currency = 'IDR',
            customerData,
            billingPeriod = 'monthly'
        } = subscriptionData;

        const externalId = `SUB-${tenantId}-${planId}-${Date.now()}`;
        
        // Create Xendit Invoice
        const invoiceData = {
            external_id: externalId,
            amount: Math.round(amount),
            currency: currency,
            customer: {
                given_names: customerData.firstName,
                surname: customerData.lastName,
                email: customerData.email,
                mobile_number: customerData.phone,
                addresses: customerData.address ? [{
                    city: customerData.city || '',
                    country: 'Indonesia',
                    postal_code: customerData.postalCode || '',
                    state: customerData.state || '',
                    street_line1: customerData.address
                }] : []
            },
            description: `${planName} - ${billingPeriod} subscription`,
            invoice_duration: 86400, // 24 hours in seconds
            success_redirect_url: `${process.env.APP_URL}/payment/success?provider=xendit`,
            failure_redirect_url: `${process.env.APP_URL}/payment/error?provider=xendit`,
            payment_methods: [
                'BANK_TRANSFER',
                'CREDIT_CARD',
                'EWALLET',
                'RETAIL_OUTLET',
                'QR_CODE'
            ],
            metadata: {
                tenant_id: tenantId,
                plan_id: planId,
                billing_period: billingPeriod
            },
            items: [{
                name: `${planName} Subscription`,
                quantity: 1,
                price: Math.round(amount),
                category: 'subscription'
            }]
        };

        const invoice = await this.xendit.Invoice.createInvoice(invoiceData);
        
        logger.info('Xendit payment created:', {
            externalId,
            tenantId,
            planId,
            amount,
            invoiceId: invoice.id
        });

        return {
            provider: 'xendit',
            orderId: externalId,
            paymentToken: invoice.id,
            paymentUrl: invoice.invoice_url,
            expiresAt: new Date(invoice.expiry_date),
            metadata: {
                tenantId,
                planId,
                billingPeriod,
                amount,
                currency,
                invoiceId: invoice.id
            }
        };
    }

    /**
     * Handle Midtrans webhook/notification
     */
    async handleMidtransWebhook(notification) {
        try {
            const statusResponse = await this.midtransCoreApi.transaction.notification(notification);
            
            const {
                order_id,
                transaction_status,
                fraud_status,
                gross_amount,
                custom_field1: tenantId,
                custom_field2: planId,
                custom_field3: billingPeriod
            } = statusResponse;

            logger.info('Midtrans webhook received:', {
                orderId: order_id,
                status: transaction_status,
                fraudStatus: fraud_status,
                tenantId,
                planId
            });

            let paymentStatus = 'pending';
            
            if (transaction_status === 'capture') {
                if (fraud_status === 'challenge') {
                    paymentStatus = 'challenge';
                } else if (fraud_status === 'accept') {
                    paymentStatus = 'success';
                }
            } else if (transaction_status === 'settlement') {
                paymentStatus = 'success';
            } else if (transaction_status === 'cancel' || 
                       transaction_status === 'deny' || 
                       transaction_status === 'expire') {
                paymentStatus = 'failed';
            } else if (transaction_status === 'pending') {
                paymentStatus = 'pending';
            }

            return {
                orderId: order_id,
                status: paymentStatus,
                amount: parseFloat(gross_amount),
                tenantId,
                planId,
                billingPeriod,
                provider: 'midtrans',
                rawData: statusResponse
            };
            
        } catch (error) {
            logger.error('Error handling Midtrans webhook:', error);
            throw error;
        }
    }

    /**
     * Handle Xendit webhook
     */
    async handleXenditWebhook(webhookData, signature) {
        try {
            // Verify webhook signature
            if (!this.verifyXenditSignature(webhookData, signature)) {
                throw new Error('Invalid Xendit webhook signature');
            }

            const {
                external_id,
                status,
                amount,
                metadata,
                id: invoiceId
            } = webhookData;

            logger.info('Xendit webhook received:', {
                externalId: external_id,
                status,
                amount,
                invoiceId
            });

            let paymentStatus = 'pending';
            
            if (status === 'PAID') {
                paymentStatus = 'success';
            } else if (status === 'EXPIRED' || status === 'FAILED') {
                paymentStatus = 'failed';
            } else if (status === 'PENDING') {
                paymentStatus = 'pending';
            }

            return {
                orderId: external_id,
                status: paymentStatus,
                amount: parseFloat(amount),
                tenantId: metadata?.tenant_id,
                planId: metadata?.plan_id,
                billingPeriod: metadata?.billing_period,
                provider: 'xendit',
                rawData: webhookData
            };
            
        } catch (error) {
            logger.error('Error handling Xendit webhook:', error);
            throw error;
        }
    }

    /**
     * Verify Xendit webhook signature
     */
    verifyXenditSignature(payload, signature) {
        try {
            const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN;
            if (!webhookToken) {
                logger.warn('Xendit webhook token not configured');
                return true; // Skip verification in development
            }

            const computedSignature = crypto
                .createHmac('sha256', webhookToken)
                .update(JSON.stringify(payload), 'utf8')
                .digest('hex');

            return computedSignature === signature;
        } catch (error) {
            logger.error('Error verifying Xendit signature:', error);
            return false;
        }
    }

    /**
     * Get payment status from provider
     */
    async getPaymentStatus(orderId, provider) {
        try {
            if (provider === 'midtrans') {
                const statusResponse = await this.midtransCoreApi.transaction.status(orderId);
                
                let status = 'pending';
                if (statusResponse.transaction_status === 'settlement') {
                    status = 'success';
                } else if (['cancel', 'deny', 'expire'].includes(statusResponse.transaction_status)) {
                    status = 'failed';
                }
                
                return {
                    orderId,
                    status,
                    amount: parseFloat(statusResponse.gross_amount),
                    provider: 'midtrans',
                    rawData: statusResponse
                };
                
            } else if (provider === 'xendit') {
                // For Xendit, we need to store the invoice ID separately
                // This is a simplified version - in production, store mapping in database
                const invoice = await this.xendit.Invoice.getInvoice({ invoiceId: orderId });
                
                let status = 'pending';
                if (invoice.status === 'PAID') {
                    status = 'success';
                } else if (['EXPIRED', 'FAILED'].includes(invoice.status)) {
                    status = 'failed';
                }
                
                return {
                    orderId: invoice.external_id,
                    status,
                    amount: parseFloat(invoice.amount),
                    provider: 'xendit',
                    rawData: invoice
                };
            }
            
            throw new Error(`Unsupported provider: ${provider}`);
            
        } catch (error) {
            logger.error('Error getting payment status:', error);
            throw error;
        }
    }

    /**
     * Cancel payment
     */
    async cancelPayment(orderId, provider) {
        try {
            if (provider === 'midtrans') {
                const response = await this.midtransCoreApi.transaction.cancel(orderId);
                return response;
            } else if (provider === 'xendit') {
                const response = await this.xendit.Invoice.expireInvoice({ invoiceId: orderId });
                return response;
            }
            
            throw new Error(`Unsupported provider: ${provider}`);
            
        } catch (error) {
            logger.error('Error canceling payment:', error);
            throw error;
        }
    }

    /**
     * Create recurring subscription (for future implementation)
     */
    async createRecurringSubscription(subscriptionData, provider = 'midtrans') {
        try {
            // This is for future implementation of recurring payments
            // Both Midtrans and Xendit support recurring payments with different approaches
            
            if (provider === 'midtrans') {
                // Midtrans uses subscription feature
                throw new Error('Midtrans recurring subscription not implemented yet');
            } else if (provider === 'xendit') {
                // Xendit uses recurring payments
                throw new Error('Xendit recurring subscription not implemented yet');
            }
            
        } catch (error) {
            logger.error('Error creating recurring subscription:', error);
            throw error;
        }
    }

    /**
     * Get available payment methods for provider
     */
    getAvailablePaymentMethods(provider) {
        const methods = {
            midtrans: [
                'credit_card',
                'bank_transfer',
                'bca_va',
                'bni_va',
                'bri_va',
                'permata_va',
                'other_va',
                'gopay',
                'shopeepay',
                'dana',
                'linkaja',
                'qris',
                'akulaku',
                'kredivo',
                'alfamart',
                'indomaret'
            ],
            xendit: [
                'CREDIT_CARD',
                'BANK_TRANSFER',
                'BCA',
                'BNI',
                'BRI',
                'MANDIRI',
                'PERMATA',
                'OVO',
                'DANA',
                'LINKAJA',
                'SHOPEEPAY',
                'GOPAY',
                'QR_CODE',
                'ALFAMART',
                'INDOMARET'
            ]
        };

        return methods[provider] || [];
    }

    /**
     * Format currency for Indonesian market
     */
    formatCurrency(amount, currency = 'IDR') {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    }
}

module.exports = new PaymentService();

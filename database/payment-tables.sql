-- Additional Payment Tables for Midtrans and Xendit Integration
-- Add this to the existing saas-schema.sql

-- Tabel Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'IDR',
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('midtrans', 'xendit', 'stripe')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'expired', 'challenge')),
    billing_period VARCHAR(20) DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    customer_data JSONB NOT NULL,
    payment_token VARCHAR(500),
    payment_url VARCHAR(1000),
    expires_at TIMESTAMP WITH TIME ZONE,
    raw_response JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by INTEGER REFERENCES tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Payment Methods (untuk menyimpan method yang tersedia per tenant)
CREATE TABLE IF NOT EXISTS tenant_payment_settings (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('midtrans', 'xendit', 'stripe')),
    is_enabled BOOLEAN DEFAULT FALSE,
    configuration JSONB DEFAULT '{}'::jsonb,
    credentials_encrypted TEXT, -- Encrypted credentials
    webhook_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_provider UNIQUE(tenant_id, provider)
);

-- Tabel Payment Webhooks Log (untuk debugging)
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(20) NOT NULL,
    webhook_type VARCHAR(50),
    order_id VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id),
    payload JSONB NOT NULL,
    headers JSONB,
    ip_address INET,
    status_code INTEGER DEFAULT 200,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk Session Storage (required for express-session with pg)
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
);

ALTER TABLE "user_sessions" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");

-- Create indexes for payment tables
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider);

CREATE INDEX IF NOT EXISTS idx_tenant_payment_settings_tenant ON tenant_payment_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payment_settings_provider ON tenant_payment_settings(provider, is_enabled);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_provider ON payment_webhook_logs(provider, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_order_id ON payment_webhook_logs(order_id);

-- Update subscription plans dengan harga dalam IDR
UPDATE subscription_plans SET 
    price = CASE 
        WHEN slug = 'free' THEN 0
        WHEN slug = 'starter' THEN 449000  -- ~$29.99 USD
        WHEN slug = 'professional' THEN 1199000  -- ~$79.99 USD
        WHEN slug = 'enterprise' THEN 2999000  -- ~$199.99 USD
    END,
    currency = 'IDR'
WHERE slug IN ('free', 'starter', 'professional', 'enterprise');

-- Add Indonesian payment method features to plans
UPDATE subscription_plans SET 
    features = CASE 
        WHEN slug = 'free' THEN 
            '["Basic QR codes", "Email notifications", "Basic analytics", "Standard support", "Bank transfer payment"]'::jsonb
        WHEN slug = 'starter' THEN 
            '["Custom branding", "Advanced analytics", "CSV export", "Priority support", "Custom categories", "Event templates", "Multiple payment methods", "Indonesian payment gateways"]'::jsonb
        WHEN slug = 'professional' THEN 
            '["White label solution", "API access", "Custom domains", "Advanced integrations", "Bulk operations", "Advanced reporting", "All payment methods", "Recurring subscriptions", "Multi-currency support"]'::jsonb
        WHEN slug = 'enterprise' THEN 
            '["Everything included", "Custom features", "Dedicated support", "SLA guarantee", "On-premise option", "Custom integrations", "Priority payment processing", "Custom payment flows", "Advanced fraud protection"]'::jsonb
    END
WHERE slug IN ('free', 'starter', 'professional', 'enterprise');

-- Insert default payment settings for demo tenant
DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo';
    
    IF demo_tenant_id IS NOT NULL THEN
        -- Enable Midtrans for demo tenant
        INSERT INTO tenant_payment_settings (tenant_id, provider, is_enabled, configuration, webhook_url)
        VALUES (
            demo_tenant_id, 
            'midtrans', 
            true, 
            '{"environment": "sandbox", "enabled_methods": ["credit_card", "bank_transfer", "gopay", "shopeepay"]}'::jsonb,
            CONCAT(COALESCE(current_setting('app.base_url', true), 'http://localhost:3000'), '/api/payment/webhook/midtrans')
        ) ON CONFLICT (tenant_id, provider) DO NOTHING;
        
        -- Enable Xendit for demo tenant
        INSERT INTO tenant_payment_settings (tenant_id, provider, is_enabled, configuration, webhook_url)
        VALUES (
            demo_tenant_id, 
            'xendit', 
            true, 
            '{"environment": "test", "enabled_methods": ["CREDIT_CARD", "BANK_TRANSFER", "OVO", "DANA", "SHOPEEPAY"]}'::jsonb,
            CONCAT(COALESCE(current_setting('app.base_url', true), 'http://localhost:3000'), '/api/payment/webhook/xendit')
        ) ON CONFLICT (tenant_id, provider) DO NOTHING;
    END IF;
END $$;

-- Create trigger to update updated_at for payment tables
CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_payment_settings_updated_at 
    BEFORE UPDATE ON tenant_payment_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get active subscription with payment info
CREATE OR REPLACE FUNCTION get_tenant_subscription_with_payment(tenant_uuid UUID)
RETURNS TABLE (
    subscription_id INTEGER,
    plan_name VARCHAR,
    plan_slug VARCHAR,
    plan_price DECIMAL,
    status VARCHAR,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    last_payment_date TIMESTAMP,
    last_payment_amount DECIMAL,
    last_payment_provider VARCHAR,
    next_billing_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ts.id as subscription_id,
        sp.name as plan_name,
        sp.slug as plan_slug,
        sp.price as plan_price,
        ts.status::VARCHAR,
        ts.starts_at,
        ts.ends_at,
        pt.created_at as last_payment_date,
        pt.amount as last_payment_amount,
        pt.provider::VARCHAR as last_payment_provider,
        ts.ends_at as next_billing_date
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    LEFT JOIN payment_transactions pt ON ts.tenant_id = pt.tenant_id 
        AND pt.status = 'success' 
        AND pt.created_at = (
            SELECT MAX(created_at) 
            FROM payment_transactions 
            WHERE tenant_id = tenant_uuid AND status = 'success'
        )
    WHERE ts.tenant_id = tenant_uuid 
        AND ts.status = 'active'
    ORDER BY ts.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

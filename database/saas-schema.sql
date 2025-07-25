-- SaaS Multi-Tenant Database Schema
-- PostgreSQL 14+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Drop tables if exists (untuk development)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS tenant_users CASCADE;
DROP TABLE IF EXISTS tenant_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS guest_categories CASCADE;

-- Tabel Subscription Plans
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
    max_events INTEGER DEFAULT 1,
    max_visitors_per_event INTEGER DEFAULT 100,
    max_admin_users INTEGER DEFAULT 2,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, description, price, max_events, max_visitors_per_event, max_admin_users, features, sort_order) VALUES
('Free', 'free', 'Perfect for trying out our platform', 0.00, 1, 50, 1, 
 '["Basic QR codes", "Email notifications", "Basic analytics", "Standard support"]'::jsonb, 1),
('Starter', 'starter', 'Great for small to medium events', 29.99, 5, 500, 3, 
 '["Custom branding", "Advanced analytics", "CSV export", "Priority support", "Custom categories", "Event templates"]'::jsonb, 2),
('Professional', 'professional', 'For professional event organizers', 79.99, 25, 2500, 10, 
 '["White label solution", "API access", "Custom domains", "Advanced integrations", "Bulk operations", "Advanced reporting"]'::jsonb, 3),
('Enterprise', 'enterprise', 'For large organizations', 199.99, 999999, 999999, 999999, 
 '["Everything included", "Custom features", "Dedicated support", "SLA guarantee", "On-premise option", "Custom integrations"]'::jsonb, 4);

-- Tabel Tenants (Organizations/Companies)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    custom_domain VARCHAR(255),
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    brand_colors JSONB DEFAULT '{"primary": "#007bff", "secondary": "#6c757d", "accent": "#28a745"}'::jsonb,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    company_address TEXT,
    website_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(10) DEFAULT '24h',
    currency VARCHAR(3) DEFAULT 'USD',
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9-]+$')
);

-- Tabel Tenant Subscriptions
CREATE TABLE tenant_subscriptions (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended', 'trialing')),
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    stripe_product_id VARCHAR(255),
    billing_email VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Tenant Users (Admin users per tenant)
CREATE TABLE tenant_users (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,
    avatar_url VARCHAR(500),
    phone VARCHAR(20),
    job_title VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_email UNIQUE(tenant_id, email)
);

-- Tabel Guest Categories (per tenant)
CREATE TABLE guest_categories (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#007bff',
    icon VARCHAR(50) NOT NULL DEFAULT 'bi-person',
    priority INTEGER NOT NULL DEFAULT 1,
    benefits JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_category_code UNIQUE(tenant_id, code),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Tabel Events (per tenant)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    location VARCHAR(500) NOT NULL,
    venue_name VARCHAR(255),
    venue_address TEXT,
    venue_latitude DECIMAL(10, 8),
    venue_longitude DECIMAL(11, 8),
    max_capacity INTEGER DEFAULT 1000,
    registration_start_date TIMESTAMP WITH TIME ZONE,
    registration_end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed', 'cancelled')),
    cover_image_url VARCHAR(500),
    banner_image_url VARCHAR(500),
    registration_form_settings JSONB DEFAULT '{"show_categories": true, "default_category_id": null, "simplified_form": false}'::jsonb,
    email_settings JSONB DEFAULT '{}'::jsonb,
    qr_settings JSONB DEFAULT '{}'::jsonb,
    checkin_settings JSONB DEFAULT '{}'::jsonb,
    analytics_settings JSONB DEFAULT '{}'::jsonb,
    created_by INTEGER REFERENCES tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_event_slug UNIQUE(tenant_id, slug),
    CONSTRAINT valid_event_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_event_times CHECK (end_time > start_time)
);

-- Tabel Visitors (per tenant per event)
CREATE TABLE visitors (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registration_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    job_title VARCHAR(255),
    category_id INTEGER NOT NULL REFERENCES guest_categories(id),
    qr_code_data TEXT,
    qr_code_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'checked_in', 'checked_out', 'no_show', 'cancelled')),
    special_requirements TEXT,
    dietary_restrictions TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    photo_url VARCHAR(500),
    custom_fields JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    registration_source VARCHAR(50) DEFAULT 'web',
    referral_code VARCHAR(50),
    notes TEXT,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_event_email UNIQUE(tenant_id, event_id, email),
    CONSTRAINT unique_tenant_registration_code UNIQUE(tenant_id, registration_code)
);

-- Tabel Check-ins
CREATE TABLE checkins (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visitor_id INTEGER NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    checkin_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checkout_time TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255) DEFAULT 'Main Entrance',
    gate_number VARCHAR(10),
    checked_in_by INTEGER REFERENCES tenant_users(id),
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    notes TEXT,
    is_manual BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Activity Logs (per tenant)
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES tenant_users(id),
    visitor_id INTEGER REFERENCES visitors(id),
    event_id INTEGER REFERENCES events(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- visitor, event, user, etc.
    entity_id INTEGER,
    description TEXT,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create comprehensive indexes for performance
CREATE INDEX idx_tenants_slug ON tenants(slug) WHERE is_active = true;
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain) WHERE is_active = true;
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_tenants_active ON tenants(is_active, created_at);

CREATE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status, ends_at);
CREATE INDEX idx_tenant_subscriptions_stripe ON tenant_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id) WHERE is_active = true;
CREATE INDEX idx_tenant_users_email ON tenant_users(email);
CREATE INDEX idx_tenant_users_tenant_email ON tenant_users(tenant_id, email) WHERE is_active = true;
CREATE INDEX idx_tenant_users_role ON tenant_users(tenant_id, role) WHERE is_active = true;

CREATE INDEX idx_guest_categories_tenant ON guest_categories(tenant_id) WHERE is_active = true;
CREATE INDEX idx_guest_categories_code ON guest_categories(tenant_id, code) WHERE is_active = true;

CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_tenant_slug ON events(tenant_id, slug);
CREATE INDEX idx_events_status ON events(status, event_date);
CREATE INDEX idx_events_date ON events(event_date, start_time);
CREATE INDEX idx_events_active ON events(tenant_id, status) WHERE status IN ('published', 'active');

CREATE INDEX idx_visitors_tenant ON visitors(tenant_id);
CREATE INDEX idx_visitors_event ON visitors(event_id);
CREATE INDEX idx_visitors_tenant_email ON visitors(tenant_id, email);
CREATE INDEX idx_visitors_registration_code ON visitors(registration_code);
CREATE INDEX idx_visitors_status ON visitors(status, registered_at);
CREATE INDEX idx_visitors_category ON visitors(category_id);
CREATE INDEX idx_visitors_search ON visitors USING gin((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);

CREATE INDEX idx_checkins_tenant ON checkins(tenant_id);
CREATE INDEX idx_checkins_visitor ON checkins(visitor_id);
CREATE INDEX idx_checkins_event ON checkins(event_id);
CREATE INDEX idx_checkins_time ON checkins(checkin_time);
CREATE INDEX idx_checkins_event_time ON checkins(event_id, checkin_time);

CREATE INDEX idx_activity_logs_tenant ON activity_logs(tenant_id, created_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action, created_at);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at) WHERE user_id IS NOT NULL;

-- Create materialized views for analytics
CREATE MATERIALIZED VIEW tenant_analytics AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    sp.name as plan_name,
    COUNT(DISTINCT e.id) as total_events,
    COUNT(DISTINCT v.id) as total_visitors,
    COUNT(DISTINCT c.id) as total_checkins,
    COUNT(DISTINCT tu.id) as total_users,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'registered') as registered_visitors,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'checked_in') as checked_in_visitors,
    ROUND(
        (COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'checked_in')::DECIMAL / 
         NULLIF(COUNT(DISTINCT v.id), 0)) * 100, 2
    ) as checkin_percentage,
    t.created_at as tenant_created_at
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id AND ts.status = 'active'
LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
LEFT JOIN events e ON t.id = e.tenant_id
LEFT JOIN visitors v ON t.id = v.tenant_id
LEFT JOIN checkins c ON t.id = c.tenant_id
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id AND tu.is_active = true
WHERE t.is_active = true
GROUP BY t.id, t.name, t.slug, sp.name, t.created_at;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_tenant_analytics_tenant_id ON tenant_analytics(tenant_id);

-- Functions for tenant management
CREATE OR REPLACE FUNCTION generate_registration_code(tenant_uuid UUID, category_code VARCHAR(10))
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    new_code VARCHAR(50);
    prefix VARCHAR(20);
BEGIN
    -- Create a prefix with category code and year
    prefix := category_code || TO_CHAR(CURRENT_DATE, 'YY');
    
    -- Get next number for this category in this tenant
    SELECT COALESCE(MAX(CAST(SUBSTRING(registration_code FROM LENGTH(prefix) + 1) AS INTEGER)), 0) + 1
    INTO next_number
    FROM visitors v
    JOIN guest_categories gc ON v.category_id = gc.id
    WHERE v.tenant_id = tenant_uuid 
      AND gc.code = category_code 
      AND registration_code LIKE prefix || '%';
    
    -- Format: VIP24001, SPR24001, etc.
    new_code := prefix || LPAD(next_number::TEXT, 4, '0');
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to check tenant limits
CREATE OR REPLACE FUNCTION check_tenant_limits(tenant_uuid UUID, limit_type VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
    current_plan subscription_plans%ROWTYPE;
    current_count INTEGER := 0;
BEGIN
    -- Get current active plan
    SELECT sp.* INTO current_plan
    FROM subscription_plans sp
    JOIN tenant_subscriptions ts ON sp.id = ts.plan_id
    WHERE ts.tenant_id = tenant_uuid 
      AND ts.status = 'active'
      AND (ts.ends_at IS NULL OR ts.ends_at > CURRENT_TIMESTAMP)
    ORDER BY ts.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check specific limits
    CASE limit_type
        WHEN 'events' THEN
            SELECT COUNT(*) INTO current_count 
            FROM events WHERE tenant_id = tenant_uuid;
            RETURN current_count < current_plan.max_events;
            
        WHEN 'users' THEN
            SELECT COUNT(*) INTO current_count 
            FROM tenant_users WHERE tenant_id = tenant_uuid AND is_active = true;
            RETURN current_count < current_plan.max_admin_users;
            
        WHEN 'visitors_per_event' THEN
            -- This should be called with event_id in context
            RETURN TRUE; -- Implement per-event check as needed
            
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate registration code
CREATE OR REPLACE FUNCTION set_registration_code()
RETURNS TRIGGER AS $$
DECLARE
    category_code VARCHAR(10);
BEGIN
    -- Get category code
    SELECT code INTO category_code
    FROM guest_categories
    WHERE id = NEW.category_id;
    
    -- Generate registration code if not provided
    IF NEW.registration_code IS NULL OR NEW.registration_code = '' THEN
        NEW.registration_code := generate_registration_code(NEW.tenant_id, category_code);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_registration_code
    BEFORE INSERT ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION set_registration_code();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all relevant tables
CREATE TRIGGER update_tenants_updated_at 
    BEFORE UPDATE ON tenants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at 
    BEFORE UPDATE ON tenant_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at 
    BEFORE UPDATE ON tenant_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guest_categories_updated_at 
    BEFORE UPDATE ON guest_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at 
    BEFORE UPDATE ON visitors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_analytics;
END;
$$ LANGUAGE plpgsql;

-- Insert default tenant for development
INSERT INTO tenants (name, slug, subdomain, contact_email, onboarding_completed) 
VALUES ('Demo Company', 'demo', 'demo', 'admin@demo.com', true);

-- Get the demo tenant ID
DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo';
    
    -- Insert demo subscription
    INSERT INTO tenant_subscriptions (tenant_id, plan_id, status)
    VALUES (demo_tenant_id, (SELECT id FROM subscription_plans WHERE slug = 'starter'), 'active');
    
    -- Insert demo admin user
    INSERT INTO tenant_users (tenant_id, email, password_hash, first_name, last_name, role, email_verified_at)
    VALUES (demo_tenant_id, 'admin@demo.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36UmzA6TUfbiFNjxpXIf3Gm', 'Demo', 'Admin', 'owner', CURRENT_TIMESTAMP);
    
    -- Insert demo guest categories
    INSERT INTO guest_categories (tenant_id, name, code, description, color, icon, priority, benefits, is_default) VALUES
    (demo_tenant_id, 'VIP', 'VIP', 'Very Important Person - Tamu terhormat dengan akses khusus', '#FFD700', 'bi-crown-fill', 1, 
     '["VIP Lounge Access", "Priority Check-in", "Welcome Kit Premium", "Reserved Parking"]'::jsonb, false),
    (demo_tenant_id, 'Sponsor', 'SPR', 'Sponsor acara dengan hak istimewa khusus', '#FF6B35', 'bi-handshake-fill', 2, 
     '["Sponsor Booth Access", "Networking Session", "Brand Visibility", "Premium Location"]'::jsonb, false),
    (demo_tenant_id, 'Speaker', 'SPK', 'Pembicara dan narasumber acara', '#4ECDC4', 'bi-mic-fill', 2, 
     '["Speaker Lounge", "AV Equipment Support", "Accommodation Assistance", "Transportation"]'::jsonb, false),
    (demo_tenant_id, 'Participant', 'PTC', 'Peserta umum acara', '#45B7D1', 'bi-people-fill', 4, 
     '["Event Access", "Event Materials", "Certificate of Attendance", "Networking Opportunity"]'::jsonb, true);
END $$;

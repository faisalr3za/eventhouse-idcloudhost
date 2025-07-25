const db = require('../../config/database');
const logger = require('../utils/logger');

class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    async findById(id, tenantId = null) {
        try {
            const whereClause = tenantId ? 'WHERE id = $1 AND tenant_id = $2' : 'WHERE id = $1';
            const params = tenantId ? [id, tenantId] : [id];
            
            const result = await this.db.query(
                `SELECT * FROM ${this.tableName} ${whereClause}`,
                params
            );
            
            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error finding ${this.tableName} by ID:`, error);
            throw error;
        }
    }

    async findAll(tenantId = null, options = {}) {
        try {
            const { limit = 100, offset = 0, orderBy = 'created_at', orderDirection = 'DESC' } = options;
            
            let whereClause = '';
            let params = [];
            
            if (tenantId) {
                whereClause = 'WHERE tenant_id = $1';
                params = [tenantId];
            }
            
            const result = await this.db.query(
                `SELECT * FROM ${this.tableName} ${whereClause} 
                 ORDER BY ${orderBy} ${orderDirection} 
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            );
            
            return result.rows;
        } catch (error) {
            logger.error(`Error finding all ${this.tableName}:`, error);
            throw error;
        }
    }

    async create(data) {
        try {
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
            
            const result = await this.db.query(
                `INSERT INTO ${this.tableName} (${keys.join(', ')}) 
                 VALUES (${placeholders}) 
                 RETURNING *`,
                values
            );
            
            return result.rows[0];
        } catch (error) {
            logger.error(`Error creating ${this.tableName}:`, error);
            throw error;
        }
    }

    async update(id, data, tenantId = null) {
        try {
            const keys = Object.keys(data);
            const values = Object.values(data);
            const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
            
            let whereClause = `WHERE id = $${keys.length + 1}`;
            let params = [...values, id];
            
            if (tenantId) {
                whereClause += ` AND tenant_id = $${keys.length + 2}`;
                params.push(tenantId);
            }
            
            const result = await this.db.query(
                `UPDATE ${this.tableName} SET ${setClause} ${whereClause} RETURNING *`,
                params
            );
            
            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error updating ${this.tableName}:`, error);
            throw error;
        }
    }

    async delete(id, tenantId = null) {
        try {
            const whereClause = tenantId ? 'WHERE id = $1 AND tenant_id = $2' : 'WHERE id = $1';
            const params = tenantId ? [id, tenantId] : [id];
            
            const result = await this.db.query(
                `DELETE FROM ${this.tableName} ${whereClause} RETURNING *`,
                params
            );
            
            return result.rows[0] || null;
        } catch (error) {
            logger.error(`Error deleting ${this.tableName}:`, error);
            throw error;
        }
    }

    async count(tenantId = null) {
        try {
            let whereClause = '';
            let params = [];
            
            if (tenantId) {
                whereClause = 'WHERE tenant_id = $1';
                params = [tenantId];
            }
            
            const result = await this.db.query(
                `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
                params
            );
            
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error(`Error counting ${this.tableName}:`, error);
            throw error;
        }
    }
}

class TenantModel extends BaseModel {
    constructor() {
        super('tenants');
    }

    async findBySlug(slug) {
        try {
            const result = await this.db.query(
                'SELECT * FROM tenants WHERE slug = $1 AND is_active = true',
                [slug]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding tenant by slug:', error);
            throw error;
        }
    }

    async findBySubdomain(subdomain) {
        try {
            const result = await this.db.query(
                'SELECT * FROM tenants WHERE subdomain = $1 AND is_active = true',
                [subdomain]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding tenant by subdomain:', error);
            throw error;
        }
    }

    async findByCustomDomain(domain) {
        try {
            const result = await this.db.query(
                'SELECT * FROM tenants WHERE custom_domain = $1 AND is_active = true',
                [domain]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding tenant by custom domain:', error);
            throw error;
        }
    }

    async getSubscription(tenantId) {
        try {
            const result = await this.db.query(`
                SELECT ts.*, sp.name as plan_name, sp.slug as plan_slug, 
                       sp.max_events, sp.max_visitors_per_event, sp.max_admin_users,
                       sp.features
                FROM tenant_subscriptions ts
                JOIN subscription_plans sp ON ts.plan_id = sp.id
                WHERE ts.tenant_id = $1 AND ts.status = 'active'
                ORDER BY ts.created_at DESC
                LIMIT 1
            `, [tenantId]);
            
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting tenant subscription:', error);
            throw error;
        }
    }

    async getAnalytics(tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM tenant_analytics WHERE tenant_id = $1',
                [tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting tenant analytics:', error);
            throw error;
        }
    }
}

class TenantUserModel extends BaseModel {
    constructor() {
        super('tenant_users');
    }

    async findByEmail(email, tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM tenant_users WHERE email = $1 AND tenant_id = $2 AND is_active = true',
                [email, tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by email:', error);
            throw error;
        }
    }

    async updateLastLogin(userId) {
        try {
            await this.db.query(
                'UPDATE tenant_users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = $1',
                [userId]
            );
        } catch (error) {
            logger.error('Error updating last login:', error);
            throw error;
        }
    }

    async incrementFailedAttempts(userId) {
        try {
            await this.db.query(
                'UPDATE tenant_users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1',
                [userId]
            );
        } catch (error) {
            logger.error('Error incrementing failed attempts:', error);
            throw error;
        }
    }

    async resetFailedAttempts(userId) {
        try {
            await this.db.query(
                'UPDATE tenant_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
                [userId]
            );
        } catch (error) {
            logger.error('Error resetting failed attempts:', error);
            throw error;
        }
    }
}

class EventModel extends BaseModel {
    constructor() {
        super('events');
    }

    async findBySlug(slug, tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM events WHERE slug = $1 AND tenant_id = $2',
                [slug, tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding event by slug:', error);
            throw error;
        }
    }

    async getPublishedEvents(tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM events WHERE tenant_id = $1 AND status IN (\'published\', \'active\') ORDER BY event_date ASC',
                [tenantId]
            );
            return result.rows;
        } catch (error) {
            logger.error('Error getting published events:', error);
            throw error;
        }
    }

    async getEventStats(eventId, tenantId) {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(v.id) as total_visitors,
                    COUNT(CASE WHEN v.status = 'registered' THEN 1 END) as registered_count,
                    COUNT(CASE WHEN v.status = 'checked_in' THEN 1 END) as checked_in_count,
                    COUNT(CASE WHEN gc.code = 'VIP' THEN 1 END) as vip_count,
                    COUNT(CASE WHEN gc.code = 'SPR' THEN 1 END) as sponsor_count,
                    COUNT(CASE WHEN gc.code = 'SPK' THEN 1 END) as speaker_count,
                    COUNT(CASE WHEN gc.code = 'PTC' THEN 1 END) as participant_count
                FROM visitors v
                LEFT JOIN guest_categories gc ON v.category_id = gc.id
                WHERE v.event_id = $1 AND v.tenant_id = $2
            `, [eventId, tenantId]);
            
            return result.rows[0] || {};
        } catch (error) {
            logger.error('Error getting event stats:', error);
            throw error;
        }
    }
}

class VisitorModel extends BaseModel {
    constructor() {
        super('visitors');
    }

    async findByEmail(email, eventId, tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM visitors WHERE email = $1 AND event_id = $2 AND tenant_id = $3',
                [email, eventId, tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding visitor by email:', error);
            throw error;
        }
    }

    async findByRegistrationCode(code, tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM visitors WHERE registration_code = $1 AND tenant_id = $2',
                [code, tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding visitor by registration code:', error);
            throw error;
        }
    }

    async getVisitorsWithCategory(eventId, tenantId, options = {}) {
        try {
            const { limit = 100, offset = 0, status = null, categoryId = null } = options;
            
            let whereClause = 'WHERE v.event_id = $1 AND v.tenant_id = $2';
            let params = [eventId, tenantId];
            
            if (status) {
                whereClause += ` AND v.status = $${params.length + 1}`;
                params.push(status);
            }
            
            if (categoryId) {
                whereClause += ` AND v.category_id = $${params.length + 1}`;
                params.push(categoryId);
            }
            
            const result = await this.db.query(`
                SELECT v.*, gc.name as category_name, gc.code as category_code, 
                       gc.color as category_color, gc.icon as category_icon,
                       c.checkin_time
                FROM visitors v
                LEFT JOIN guest_categories gc ON v.category_id = gc.id
                LEFT JOIN checkins c ON v.id = c.visitor_id
                ${whereClause}
                ORDER BY v.registered_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, [...params, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting visitors with category:', error);
            throw error;
        }
    }

    async searchVisitors(eventId, tenantId, searchTerm, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            
            const result = await this.db.query(`
                SELECT v.*, gc.name as category_name, gc.code as category_code,
                       gc.color as category_color, gc.icon as category_icon
                FROM visitors v
                LEFT JOIN guest_categories gc ON v.category_id = gc.id
                WHERE v.event_id = $1 AND v.tenant_id = $2
                  AND (v.first_name ILIKE $3 OR v.last_name ILIKE $3 OR v.email ILIKE $3 OR v.registration_code ILIKE $3)
                ORDER BY v.registered_at DESC
                LIMIT $4 OFFSET $5
            `, [eventId, tenantId, `%${searchTerm}%`, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error searching visitors:', error);
            throw error;
        }
    }
}

class CheckInModel extends BaseModel {
    constructor() {
        super('checkins');
    }

    async checkIn(visitorId, tenantId, checkedInBy, options = {}) {
        try {
            const { location = 'Main Entrance', gateNumber = null, notes = null, deviceInfo = {} } = options;
            
            // Check if already checked in
            const existing = await this.db.query(
                'SELECT id FROM checkins WHERE visitor_id = $1 AND tenant_id = $2',
                [visitorId, tenantId]
            );
            
            if (existing.rows.length > 0) {
                throw new Error('Visitor already checked in');
            }
            
            // Get visitor info
            const visitor = await this.db.query(
                'SELECT event_id FROM visitors WHERE id = $1 AND tenant_id = $2',
                [visitorId, tenantId]
            );
            
            if (!visitor.rows[0]) {
                throw new Error('Visitor not found');
            }
            
            // Create check-in record
            const result = await this.db.query(`
                INSERT INTO checkins (tenant_id, visitor_id, event_id, location, gate_number, 
                                    checked_in_by, notes, device_info)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [tenantId, visitorId, visitor.rows[0].event_id, location, gateNumber, checkedInBy, notes, JSON.stringify(deviceInfo)]);
            
            // Update visitor status
            await this.db.query(
                'UPDATE visitors SET status = \'checked_in\' WHERE id = $1 AND tenant_id = $2',
                [visitorId, tenantId]
            );
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error checking in visitor:', error);
            throw error;
        }
    }

    async getRecentCheckIns(eventId, tenantId, limit = 10) {
        try {
            const result = await this.db.query(`
                SELECT c.*, v.first_name, v.last_name, v.registration_code,
                       gc.name as category_name, gc.color as category_color,
                       tu.first_name as checked_in_by_name
                FROM checkins c
                JOIN visitors v ON c.visitor_id = v.id
                LEFT JOIN guest_categories gc ON v.category_id = gc.id
                LEFT JOIN tenant_users tu ON c.checked_in_by = tu.id
                WHERE c.event_id = $1 AND c.tenant_id = $2
                ORDER BY c.checkin_time DESC
                LIMIT $3
            `, [eventId, tenantId, limit]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting recent check-ins:', error);
            throw error;
        }
    }
}

class GuestCategoryModel extends BaseModel {
    constructor() {
        super('guest_categories');
    }

    async findActiveCategories(tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM guest_categories WHERE tenant_id = $1 AND is_active = true ORDER BY priority ASC',
                [tenantId]
            );
            return result.rows;
        } catch (error) {
            logger.error('Error finding active categories:', error);
            throw error;
        }
    }

    async findByCode(code, tenantId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM guest_categories WHERE code = $1 AND tenant_id = $2 AND is_active = true',
                [code, tenantId]
            );
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding category by code:', error);
            throw error;
        }
    }
}

// Export all models
module.exports = {
    BaseModel,
    TenantModel: new TenantModel(),
    TenantUserModel: new TenantUserModel(),
    EventModel: new EventModel(),
    VisitorModel: new VisitorModel(),
    CheckInModel: new CheckInModel(),
    GuestCategoryModel: new GuestCategoryModel()
};

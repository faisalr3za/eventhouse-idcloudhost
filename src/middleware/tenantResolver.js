const { TenantModel } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to resolve tenant from request
 * Supports subdomain, custom domain, and explicit tenant header
 */
const tenantResolver = async (req, res, next) => {
    try {
        let tenant = null;
        
        // Method 1: Check for explicit tenant header (for API clients)
        const tenantHeader = req.get('X-Tenant-ID');
        if (tenantHeader) {
            tenant = await TenantModel.findById(tenantHeader);
        }
        
        // Method 2: Check subdomain (e.g., demo.eventhouse.com)
        if (!tenant && req.hostname) {
            const parts = req.hostname.split('.');
            if (parts.length >= 3) {
                const subdomain = parts[0];
                tenant = await TenantModel.findBySubdomain(subdomain);
            }
        }
        
        // Method 3: Check custom domain (e.g., events.company.com)
        if (!tenant && req.hostname && !req.hostname.includes('localhost')) {
            tenant = await TenantModel.findByCustomDomain(req.hostname);
        }
        
        // Method 4: Check for tenant slug in URL path (for development)
        if (!tenant && req.path.startsWith('/t/')) {
            const pathParts = req.path.split('/');
            if (pathParts[2]) {
                tenant = await TenantModel.findBySlug(pathParts[2]);
                // Remove tenant slug from path for further processing
                req.url = req.url.replace(`/t/${pathParts[2]}`, '');
                req.path = req.path.replace(`/t/${pathParts[2]}`, '');
            }
        }
        
        // Attach tenant to request
        req.tenant = tenant;
        
        // For API routes, tenant is usually required
        if (req.path.startsWith('/api/') && !req.path.startsWith('/api/public/')) {
            // Some API endpoints don't require tenant context
            const publicEndpoints = [
                '/api/health',
                '/api/docs',
                '/api/plans',
                '/api/signup'
            ];
            
            const isPublicEndpoint = publicEndpoints.some(endpoint => 
                req.path.startsWith(endpoint)
            );
            
            if (!isPublicEndpoint && !tenant) {
                return res.status(400).json({
                    error: 'Tenant not found',
                    message: 'Please specify a valid tenant via subdomain, custom domain, or X-Tenant-ID header'
                });
            }
        }
        
        // Add tenant info to response headers for debugging
        if (tenant && process.env.NODE_ENV === 'development') {
            res.set('X-Tenant-ID', tenant.id);
            res.set('X-Tenant-Slug', tenant.slug);
        }
        
        // Log tenant resolution for debugging
        if (tenant) {
            logger.debug('Tenant resolved', {
                tenantId: tenant.id,
                tenantSlug: tenant.slug,
                hostname: req.hostname,
                method: req.method,
                path: req.path
            });
        }
        
        next();
    } catch (error) {
        logger.error('Error resolving tenant:', error);
        
        // Don't block request for tenant resolution errors
        // Just proceed without tenant context
        req.tenant = null;
        next();
    }
};

/**
 * Middleware to require tenant context
 * Use this for routes that absolutely need tenant
 */
const requireTenant = (req, res, next) => {
    if (!req.tenant) {
        return res.status(400).json({
            error: 'Tenant required',
            message: 'This operation requires a valid tenant context'
        });
    }
    next();
};

/**
 * Middleware to check tenant subscription status
 */
const checkTenantSubscription = async (req, res, next) => {
    try {
        if (!req.tenant) {
            return next();
        }
        
        const subscription = await TenantModel.getSubscription(req.tenant.id);
        
        if (!subscription || subscription.status !== 'active') {
            return res.status(402).json({
                error: 'Subscription required',
                message: 'Your subscription is not active. Please update your billing information.',
                subscriptionStatus: subscription?.status || 'none'
            });
        }
        
        // Attach subscription info to request
        req.subscription = subscription;
        
        next();
    } catch (error) {
        logger.error('Error checking tenant subscription:', error);
        next(error);
    }
};

/**
 * Middleware to check specific subscription limits
 */
const checkSubscriptionLimit = (limitType) => {
    return async (req, res, next) => {
        try {
            if (!req.tenant || !req.subscription) {
                return next();
            }
            
            const { subscription } = req;
            let currentUsage = 0;
            let limit = 0;
            
            switch (limitType) {
                case 'events':
                    currentUsage = await EventModel.count(req.tenant.id);
                    limit = subscription.max_events;
                    break;
                    
                case 'users':
                    currentUsage = await TenantUserModel.count(req.tenant.id);
                    limit = subscription.max_admin_users;
                    break;
                    
                case 'visitors_per_event':
                    if (req.params.eventId) {
                        currentUsage = await VisitorModel.count(req.tenant.id);
                        limit = subscription.max_visitors_per_event;
                    }
                    break;
                    
                default:
                    return next();
            }
            
            if (currentUsage >= limit) {
                return res.status(429).json({
                    error: 'Subscription limit reached',
                    message: `You have reached your ${limitType} limit (${limit}). Please upgrade your subscription.`,
                    currentUsage,
                    limit,
                    limitType
                });
            }
            
            next();
        } catch (error) {
            logger.error(`Error checking ${limitType} limit:`, error);
            next(error);
        }
    };
};

module.exports = {
    tenantResolver,
    requireTenant,
    checkTenantSubscription,
    checkSubscriptionLimit
};

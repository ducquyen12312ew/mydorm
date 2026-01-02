// src/middleware/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { body, param, query, validationResult } = require('express-validator');

// ============================================
// HELMET CONFIGURATION
// ============================================
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit: 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for static files
        return req.path.startsWith('/public') || 
               req.path.startsWith('/css') || 
               req.path.startsWith('/js') ||
               req.path.startsWith('/image');
    }
});

// Strict rate limit for auth endpoints: 5 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút'
    },
    skipSuccessfulRequests: true
});

// Admin actions rate limit: 50 requests per 15 minutes
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
        error: 'Quá nhiều thao tác admin, vui lòng thử lại sau'
    }
});

// File upload rate limit: 10 uploads per hour
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        error: 'Quá nhiều file upload, vui lòng thử lại sau 1 giờ'
    }
});

// ============================================
// INPUT VALIDATION MIDDLEWARE
// ============================================

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Validation rules for common inputs
const validationRules = {
    // Student ID validation
    studentId: body('studentId')
        .trim()
        .isLength({ min: 6, max: 20 })
        .withMessage('Mã sinh viên phải từ 6-20 ký tự')
        .matches(/^[A-Za-z0-9]+$/)
        .withMessage('Mã sinh viên chỉ chứa chữ và số'),
    
    // Email validation
    email: body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Email không hợp lệ'),
    
    // Password validation
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Mật khẩu phải có ít nhất 8 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Mật khẩu phải chứa chữ hoa, chữ thường và số'),
    
    // Phone validation
    phone: body('phone')
        .optional()
        .trim()
        .matches(/^[0-9]{10,11}$/)
        .withMessage('Số điện thoại không hợp lệ'),
    
    // Name validation
    name: body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Tên phải từ 2-100 ký tự')
        .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
        .withMessage('Tên chỉ chứa chữ cái'),
    
    // Description validation
    description: body('description')
        .trim()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Mô tả phải từ 10-2000 ký tự'),
    
    // ObjectId validation
    objectId: param('id')
        .isMongoId()
        .withMessage('ID không hợp lệ'),
    
    // Status validation
    status: body('status')
        .optional()
        .isIn(['pending', 'approved', 'rejected', 'completed', 'cancelled'])
        .withMessage('Trạng thái không hợp lệ'),
    
    // Priority validation
    priority: body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Độ ưu tiên không hợp lệ'),
    
    // Severity validation
    severity: body('severity')
        .optional()
        .isIn(['low', 'medium', 'high', 'critical'])
        .withMessage('Mức độ nghiêm trọng không hợp lệ')
};

// ============================================
// XSS PROTECTION
// ============================================

const xssProtection = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    };
    
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        const sanitized = Array.isArray(obj) ? [] : {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'string') {
                    sanitized[key] = sanitizeString(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    sanitized[key] = sanitizeObject(obj[key]);
                } else {
                    sanitized[key] = obj[key];
                }
            }
        }
        
        return sanitized;
    };
    
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    
    next();
};

// ============================================
// CSRF PROTECTION (Simple token-based)
// ============================================

const generateCSRFToken = () => {
    return require('crypto').randomBytes(32).toString('hex');
};

const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET requests and API endpoints with other auth
    if (req.method === 'GET' || req.path.startsWith('/api/')) {
        return next();
    }
    
    // Generate token if not exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    
    // Verify token for POST/PUT/DELETE
    const token = req.body._csrf || req.headers['x-csrf-token'];
    
    if (token !== req.session.csrfToken) {
        return res.status(403).json({
            success: false,
            error: 'Invalid CSRF token'
        });
    }
    
    next();
};

// ============================================
// SQL/NoSQL INJECTION PROTECTION
// ============================================

const sanitizeInput = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        console.warn(`Potential NoSQL injection detected in ${key}`);
    }
});

// ============================================
// SECURE HEADERS
// ============================================

const secureHeaders = (req, res, next) => {
    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
};

// ============================================
// SESSION SECURITY
// ============================================

const secureSession = {
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    name: 'dormitory_sid', // Custom session name
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'strict' // CSRF protection
    }
};

// ============================================
// ERROR HANDLER
// ============================================

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't leak stack traces in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack })
    });
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Helmet
    helmetConfig,
    
    // Rate limiting
    apiLimiter,
    authLimiter,
    adminLimiter,
    uploadLimiter,
    
    // Validation
    validate,
    validationRules,
    
    // Protection
    xssProtection,
    csrfProtection,
    sanitizeInput,
    secureHeaders,
    
    // Session
    secureSession,
    
    // Error handling
    errorHandler
};
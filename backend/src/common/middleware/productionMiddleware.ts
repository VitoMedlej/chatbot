import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ServiceResponse } from "../models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import { env } from "../utils/envConfig";

// Input validation schemas
export const embedChatSchema = z.object({
  apiKey: z.string().min(1, "API key is required").regex(/^cb_\d+_\d+_[a-zA-Z0-9]+$/, "Invalid API key format"),
  message: z.string().min(1, "Message is required").max(1000, "Message too long (max 1000 characters)"),
  sessionId: z.string().optional(),
});

export const chatbotIdSchema = z.object({
  chatbotId: z.string().regex(/^\d+$/, "Invalid chatbot ID").transform(Number),
});

// Request validation middleware
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        const serviceResponse = ServiceResponse.failure(
          `Validation error: ${errors.join(', ')}`,
          null,
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }
      req.body = result.data;
      next();
    } catch (error) {
      const serviceResponse = ServiceResponse.failure(
        "Request validation failed",
        null,
        StatusCodes.BAD_REQUEST
      );
      return handleServiceResponse(serviceResponse, res);
    }
  };
}

// Enhanced rate limiting for embed endpoints
export const createEmbedRateLimit = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Embed rate limit
  message: {
    error: "Rate limit exceeded for chatbot embed",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per API key with IP fallback
    const apiKey = req.body?.apiKey || req.query?.apiKey || req.params?.apiKey;
    return apiKey ? `embed:${apiKey}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting in development/test
    return env.NODE_ENV !== 'production';
  },
});

// General API rate limiting
export const createApiRateLimit = () => rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: "Too many requests",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user with IP fallback
    const userId = req.user?.id;
    return userId ? `user:${userId}` : `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting in development/test
    return env.NODE_ENV !== 'production';
  },
});

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy for embed widgets
  if (req.path.includes('/embed/widget/')) {
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; connect-src 'self' https:;");
  }
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

// Request sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    // Remove any potential script tags or malicious content
    req.body = JSON.parse(JSON.stringify(req.body).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''));
  }
  next();
};

// Error logging middleware
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    error: error.message,
    stack: env.NODE_ENV === 'development' ? error.stack : undefined,
    userId: req.user?.id,
    chatbotId: req.validatedChatbotId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  
  // Don't expose internal errors in production
  if (env.NODE_ENV === 'production') {
    const serviceResponse = ServiceResponse.failure(
      "Internal server error",
      null,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
    return handleServiceResponse(serviceResponse, res);
  }
  
  next(error);
};

// Usage analytics middleware
export const usageAnalytics = (req: Request, res: Response, next: NextFunction) => {
  // Simple check - enable logging in production unless explicitly disabled
  const loggingEnabled = env.NODE_ENV === 'production' || process.env.ENABLE_REQUEST_LOGGING !== 'false';
  
  if (!loggingEnabled) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Log request
  console.info(`[REQUEST] ${req.method} ${req.path}`, {
    userId: req.user?.id,
    chatbotId: req.validatedChatbotId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.info(`[RESPONSE] ${req.method} ${req.path} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      userId: req.user?.id,
      chatbotId: req.validatedChatbotId,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    });
  });
  
  next();
};

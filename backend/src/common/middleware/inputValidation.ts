import { RequestHandler } from "express";
import { ServiceResponse } from "../models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";

// Basic input sanitization to prevent common injection attacks
export const sanitizeInput: RequestHandler = (req, res, next) => {
  try {
    // Recursively sanitize all string values in request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    const serviceResponse = ServiceResponse.failure("Invalid input format", null, StatusCodes.BAD_REQUEST);
    return handleServiceResponse(serviceResponse, res);
  }
};

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    // Basic HTML tag removal and script injection prevention
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Validate file uploads
export const validateFileUpload: RequestHandler = (req, res, next) => {
  if (req.file) {
    const allowedMimeTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      const serviceResponse = ServiceResponse.failure("Invalid file type", null, StatusCodes.BAD_REQUEST);
      return handleServiceResponse(serviceResponse, res);
    }
    
    if (req.file.size > maxFileSize) {
      const serviceResponse = ServiceResponse.failure("File size too large (max 10MB)", null, StatusCodes.BAD_REQUEST);
      return handleServiceResponse(serviceResponse, res);
    }
  }
  
  next();
};

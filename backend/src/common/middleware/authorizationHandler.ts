import { RequestHandler } from "express";
import { ServiceResponse } from "../models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";

// Middleware to check if user owns the resource (chatbot)
export const validateChatbotOwnership: RequestHandler = async (req, res, next) => {
    const userId = req.user?.id;
    const chatbotId = req.params.chatbotId || req.body.chatbotId;
    
    if (!userId) {
        const serviceResponse = ServiceResponse.failure("User ID missing from token", null, StatusCodes.UNAUTHORIZED);
        return handleServiceResponse(serviceResponse, res);
    }
    
    if (!chatbotId) {
        const serviceResponse = ServiceResponse.failure("Chatbot ID missing", null, StatusCodes.BAD_REQUEST);
        return handleServiceResponse(serviceResponse, res);
    }
    
    // TODO: Add database check to verify user owns this chatbot
    // For now, we'll add the validation logic and implement the DB check later
    
    next();
};

// Middleware to check admin role
export const requireAdminRole: RequestHandler = (req, res, next) => {
    const userRole = req.user?.role;
    
    if (userRole !== 'admin') {
        const serviceResponse = ServiceResponse.failure("Admin access required", null, StatusCodes.FORBIDDEN);
        return handleServiceResponse(serviceResponse, res);
    }
    
    next();
};

// Middleware to validate user can only access their own data
export const validateUserAccess: RequestHandler = (req, res, next) => {
    const requestedUserId = req.params.userId || req.params.id;
    const currentUserId = req.user?.id;
    const userRole = req.user?.role;
    
    // Admin can access any user data
    if (userRole === 'admin') {
        return next();
    }
    
    // Regular users can only access their own data
    if (requestedUserId && requestedUserId !== currentUserId) {
        const serviceResponse = ServiceResponse.failure("Access denied - can only access your own data", null, StatusCodes.FORBIDDEN);
        return handleServiceResponse(serviceResponse, res);
    }
    
    next();
};

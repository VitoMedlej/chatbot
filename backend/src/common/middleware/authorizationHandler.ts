import { RequestHandler } from "express";
import { ServiceResponse } from "../models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import { supabase } from "@/server";

// Middleware to check if user owns the resource (chatbot)
export const validateChatbotOwnership: RequestHandler = async (req, res, next) => {
    const userId = req.user?.id;
    let chatbotIdParam = req.params.chatbotId || req.body.chatbotId || req.query.chatbotId;
    
    // Strict user ID validation
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.warn("Authorization failed: Missing or invalid user ID from token");
        const serviceResponse = ServiceResponse.failure("User ID missing from token", null, StatusCodes.UNAUTHORIZED);
        return handleServiceResponse(serviceResponse, res);
    }
    
    // Convert and validate chatbot ID
    const chatbotId = typeof chatbotIdParam === 'string' ? parseInt(chatbotIdParam) : chatbotIdParam;
    
    if (!Number.isInteger(chatbotId) || chatbotId <= 0) {
        console.warn("Authorization failed: Missing or invalid chatbot ID");
        const serviceResponse = ServiceResponse.failure("Invalid chatbot ID", null, StatusCodes.BAD_REQUEST);
        return handleServiceResponse(serviceResponse, res);
    }

    try {
        // Verify user owns this chatbot with explicit security checks
        const { data: chatbot, error } = await supabase
            .from("chatbots")
            .select("user_id, id")
            .eq("id", chatbotId)
            .single();

        if (error) {
            console.warn("Database error during ownership validation:", error);
            const serviceResponse = ServiceResponse.failure("Database error during authorization", null, StatusCodes.INTERNAL_SERVER_ERROR);
            return handleServiceResponse(serviceResponse, res);
        }

        if (!chatbot) {
            console.warn(`Authorization failed: Chatbot ${chatbotId} not found`);
            const serviceResponse = ServiceResponse.failure("Chatbot not found", null, StatusCodes.NOT_FOUND);
            return handleServiceResponse(serviceResponse, res);
        }

        // Triple-check ownership with strict validation
        if (!chatbot.user_id || chatbot.user_id !== userId.trim()) {
            console.warn(`Authorization failed: User ${userId} attempted access to chatbot ${chatbotId} owned by ${chatbot.user_id}`);
            const serviceResponse = ServiceResponse.failure("Access denied - chatbot not owned by user", null, StatusCodes.FORBIDDEN);
            return handleServiceResponse(serviceResponse, res);
        }

        // Additional security: Verify the chatbot ID matches exactly
        if (chatbot.id !== chatbotId) {
            console.warn("Authorization failed: Chatbot ID mismatch");
            const serviceResponse = ServiceResponse.failure("Authorization validation failed", null, StatusCodes.FORBIDDEN);
            return handleServiceResponse(serviceResponse, res);
        }

        // All checks passed - add validated IDs to request for downstream use
        req.validatedChatbotId = chatbot.id;
        req.validatedUserId = userId.trim();
        
        next();
    } catch (error) {
        console.error("Critical error validating chatbot ownership:", error);
        const serviceResponse = ServiceResponse.failure("Authorization validation failed", null, StatusCodes.INTERNAL_SERVER_ERROR);
        return handleServiceResponse(serviceResponse, res);
    }
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

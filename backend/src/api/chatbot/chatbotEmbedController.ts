import { RequestHandler } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { validateChatbotApiKey } from "./services/chatbotEmbedService";
import { productionChatbotEngine } from "./services/production/chatbotEngine";

// Rate limiting for public endpoints (per API key)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per API key

class ChatbotEmbedController {
    /**
     * Public endpoint for embedded chatbot conversations
     * Authentication via API key instead of user tokens
     */
    publicChat: RequestHandler = async (req, res) => {
        try {
            const { apiKey, message, sessionId } = req.body;
            const origin = req.get('origin') || req.get('referer');
            const domain = origin ? new URL(origin).hostname : undefined;

            // Validate required fields
            if (!apiKey || typeof apiKey !== 'string') {
                const serviceResponse = ServiceResponse.failure("API key is required", null, StatusCodes.BAD_REQUEST);
                return handleServiceResponse(serviceResponse, res);
            }

            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                const serviceResponse = ServiceResponse.failure("Message is required", null, StatusCodes.BAD_REQUEST);
                return handleServiceResponse(serviceResponse, res);
            }

            if (message.length > 1000) {
                const serviceResponse = ServiceResponse.failure("Message too long (max 1000 characters)", null, StatusCodes.BAD_REQUEST);
                return handleServiceResponse(serviceResponse, res);
            }

            // Rate limiting per API key
            const now = Date.now();
            const rateLimitKey = apiKey;
            const current = rateLimitMap.get(rateLimitKey);
            
            if (current && current.resetTime > now) {
                if (current.count >= RATE_LIMIT_MAX) {
                    const serviceResponse = ServiceResponse.failure("Rate limit exceeded. Please try again later.", null, StatusCodes.TOO_MANY_REQUESTS);
                    return handleServiceResponse(serviceResponse, res);
                }
                current.count++;
            } else {
                rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
            }

            // Validate API key and get chatbot info
            const validation = await validateChatbotApiKey(apiKey, domain);
            if (!validation.success) {
                console.warn(`Public chat API key validation failed: ${validation.message} for domain: ${domain}`);
                const serviceResponse = ServiceResponse.failure("Unauthorized", null, StatusCodes.UNAUTHORIZED);
                return handleServiceResponse(serviceResponse, res);
            }

            const { chatbotId } = validation.responseObject!;

            // Generate a session-based user ID for this conversation
            const embeddedUserId = sessionId ? `embed_${sessionId}` : `embed_${Date.now()}_${Math.random().toString(36).substring(2)}`;            // Process the chat using the production engine
            const result = await productionChatbotEngine.processChat({
                userId: embeddedUserId,
                chatbotId: String(chatbotId), // Convert number to string for chat engine
                message: message.trim()
            });

            if (!result.success) {
                const serviceResponse = ServiceResponse.failure(result.message || "Failed to process message", null, result.statusCode || StatusCodes.INTERNAL_SERVER_ERROR);
                return handleServiceResponse(serviceResponse, res);
            }

            // Return response with session ID for continued conversation
            const serviceResponse = ServiceResponse.success("Message processed", {
                response: result.responseObject,
                sessionId: embeddedUserId,
                chatbotName: validation.responseObject!.chatbotName
            });
            return handleServiceResponse(serviceResponse, res);

        } catch (error) {
            console.error("Error in public chat:", error);
            const serviceResponse = ServiceResponse.failure("Internal server error", null, StatusCodes.INTERNAL_SERVER_ERROR);
            return handleServiceResponse(serviceResponse, res);
        }
    };

    /**
     * Get chatbot configuration for embedding (public endpoint)
     */
    getChatbotConfig: RequestHandler = async (req, res) => {
        try {
            const { apiKey } = req.query;
            const origin = req.get('origin') || req.get('referer');
            const domain = origin ? new URL(origin).hostname : undefined;

            if (!apiKey || typeof apiKey !== 'string') {
                const serviceResponse = ServiceResponse.failure("API key is required", null, StatusCodes.BAD_REQUEST);
                return handleServiceResponse(serviceResponse, res);
            }

            // Validate API key and get chatbot info
            const validation = await validateChatbotApiKey(apiKey, domain);
            if (!validation.success) {
                const serviceResponse = ServiceResponse.failure("Unauthorized", null, StatusCodes.UNAUTHORIZED);
                return handleServiceResponse(serviceResponse, res);
            }

            const { chatbotName, businessName } = validation.responseObject!;

            const serviceResponse = ServiceResponse.success("Chatbot config retrieved", {
                name: chatbotName,
                businessName: businessName,
                available: true
            });
            return handleServiceResponse(serviceResponse, res);

        } catch (error) {
            console.error("Error getting chatbot config:", error);
            const serviceResponse = ServiceResponse.failure("Internal server error", null, StatusCodes.INTERNAL_SERVER_ERROR);
            return handleServiceResponse(serviceResponse, res);
        }
    };
}

export const chatbotEmbedController = new ChatbotEmbedController();

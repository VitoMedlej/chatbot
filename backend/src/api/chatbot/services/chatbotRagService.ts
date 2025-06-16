import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { productionChatbotEngine } from "./production/chatbotEngine";

async function retrieveAndAnswer(req: Request): Promise<ServiceResponse<null | { answer: string }>> {
    try {
        const { question } = req.body;
        if (!question || typeof question !== 'string' || question.trim() === '') {
            return ServiceResponse.failure("Valid question is required.", null, StatusCodes.BAD_REQUEST);
        }

        // Use validated IDs from authorization middleware for security
        const chatbotId = req.validatedChatbotId || req.body.chatbotId;
        const userId = req.validatedUserId || req.body.userId || req.user?.id;

        if (!chatbotId || !userId) {
            return ServiceResponse.failure("Missing or invalid chatbotId or userId.", null, StatusCodes.BAD_REQUEST);
        }        // Use the production engine with validated parameters
        const result = await productionChatbotEngine.processChat({
            userId: userId,
            chatbotId: String(chatbotId), // Convert number to string for chat engine
            message: question.trim()
        });

        if (!result.success) {
            return ServiceResponse.failure(result.message, null, result.statusCode);
        }

        return ServiceResponse.success("Answer generated", { answer: result.responseObject });
    } catch (err: any) {
        console.error("Error in retrieveAndAnswer:", err);
        return ServiceResponse.failure("Failed to answer question.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotRagService = { retrieveAndAnswer };
import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { productionChatbotEngine } from "./production/chatbotEngine";

async function retrieveAndAnswer(req: Request): Promise<ServiceResponse<null | { answer: string }>> {
    try {
        const { question, chatbotId } = req.body;
        if (!question || !chatbotId) {
            return ServiceResponse.failure("Missing question or chatbotId.", null, StatusCodes.BAD_REQUEST);
        }

        // Use the production engine
        const result = await productionChatbotEngine.processChat({
            userId: req.body.userId || 'anonymous', 
            chatbotId: String(chatbotId),
            message: question
        });

        if (!result.success) {
            return ServiceResponse.failure(result.message, null, result.statusCode);
        }

        return ServiceResponse.success("Answer generated", { answer: result.responseObject });
    } catch (err: any) {
        return ServiceResponse.failure("Failed to answer question.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotRagService = { retrieveAndAnswer };
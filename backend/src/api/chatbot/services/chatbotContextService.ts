import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { productionChatbotEngine } from "./production/chatbotEngine";

export async function chatWithContext(req: any): Promise<ServiceResponse<string>> {
    try {
        const { userId, chatbotId, message } = req.body;
        if (!userId || !chatbotId || !message) {
            return ServiceResponse.failure("Missing required fields.", "", StatusCodes.BAD_REQUEST);
        }

        // Use the production engine
        const result = await productionChatbotEngine.processChat({
            userId: String(userId),
            chatbotId: String(chatbotId),
            message: message
        });

        if (!result.success) {
            return ServiceResponse.failure(result.message, "", result.statusCode);
        }

        return ServiceResponse.success("Response generated", result.responseObject);
    } catch (err: any) {
        return ServiceResponse.failure("Internal server error.", "", StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
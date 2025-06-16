import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

/**
 * Lists chunks for a chatbot.
 */
export async function listChunks(chatbotId: number): Promise<ServiceResponse<any[]>> {
    try {
        // Validate chatbotId
        if (
            chatbotId === undefined ||
            chatbotId === null ||
            Number.isNaN(Number(chatbotId)) ||
            typeof chatbotId !== "number"
        ) {
            return ServiceResponse.failure(
                "Invalid or missing chatbotId.",
                [],
                StatusCodes.BAD_REQUEST
            );
        }

        const { data, error } = await supabase
            .from('document_chunks')
            .select('*')
            .eq('chatbot_id', chatbotId);

        if (error) {
            return ServiceResponse.failure(error.message, [], StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return ServiceResponse.success("Chunks retrieved", data || []);
    } catch (err: any) {
        return ServiceResponse.failure(err.message, [], StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Lists all knowledge sources for a chatbot, grouped by type.
 */
export async function listKnowledgeSources(chatbotId: number): Promise<ServiceResponse<any>> {
    try {
        if (!Number.isInteger(chatbotId) || chatbotId <= 0) {
            return ServiceResponse.failure("Invalid chatbotId.", null, StatusCodes.BAD_REQUEST);
        }

        // Query the chatbot_knowledge table
        const { data, error } = await supabase
            .from('chatbot_knowledge')
            .select('*')
            .eq('chatbot_id', chatbotId);

        if (error) {
            console.error("Supabase error while fetching knowledge sources:", error);
            return ServiceResponse.failure("Failed to fetch knowledge sources.", null, 500);
        }

        return ServiceResponse.success("Knowledge sources retrieved successfully.", data || []);
    } catch (err: any) {
        console.error("Error in listKnowledgeSources:", err);
        return ServiceResponse.failure("Internal server error.", null, 500);
    }
}

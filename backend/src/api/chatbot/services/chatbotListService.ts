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
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

/**
 * Delete chunks for a chatbot. If chunkIds are provided, only delete those chunks.
 * Handles edge cases and validates input.
 */
export async function deleteChunks(
    chatbotId: number,
    chunkIds?: number[]
): Promise<ServiceResponse<null>> {
    // Validate chatbotId
    if (
        chatbotId === undefined ||
        chatbotId === null ||
        Number.isNaN(Number(chatbotId)) ||
        typeof chatbotId !== "number"
    ) {
        return ServiceResponse.failure(
            "Invalid or missing chatbotId.",
            null,
            StatusCodes.BAD_REQUEST
        );
    }

    // Validate chunkIds if provided
    if (chunkIds !== undefined) {
        if (!Array.isArray(chunkIds)) {
            return ServiceResponse.failure(
                "chunkIds must be an array of numbers.",
                null,
                StatusCodes.BAD_REQUEST
            );
        }
        if (chunkIds.length === 0) {
            return ServiceResponse.failure(
                "chunkIds array is empty.",
                null,
                StatusCodes.BAD_REQUEST
            );
        }
        if (!chunkIds.every(id => typeof id === "number" && Number.isFinite(id) && id > 0)) {
            return ServiceResponse.failure(
                "All chunkIds must be positive numbers.",
                null,
                StatusCodes.BAD_REQUEST
            );
        }
    }

    try {
        let query = supabase
            .from('document_chunks')
            .delete({ count: 'exact' })
            .eq('chatbot_id', chatbotId);

        if (chunkIds && chunkIds.length > 0) {
            query = query.in('id', chunkIds);
        }

        const { error, count } = await query;
        if (error) {
            return ServiceResponse.failure(error.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        if (count === 0) {
            return ServiceResponse.failure(
                chunkIds && chunkIds.length > 0
                    ? "No matching chunks found for provided chunkIds and chatbotId."
                    : "No chunks found for provided chatbotId.",
                null,
                StatusCodes.NOT_FOUND
            );
        }
        return ServiceResponse.success("Chunks deleted", null);
    } catch (err: any) {
        return ServiceResponse.failure(err.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Delete an entire chatbot and all its associated data.
 * This is a destructive operation that cannot be undone.
 */
export async function deleteChatbot(chatbotId: string): Promise<ServiceResponse<any>> {
    // Validate chatbotId
    if (!chatbotId || typeof chatbotId !== 'string' || chatbotId.trim() === '') {
        return ServiceResponse.failure("Invalid or missing chatbotId", null, StatusCodes.BAD_REQUEST);
    }

    try {
        // Start a transaction-like sequence
        // 1. Delete all chatbot knowledge/chunks
        const { error: knowledgeError } = await supabase
            .from("chatbot_knowledge")
            .delete()
            .eq("chatbot_id", chatbotId);

        if (knowledgeError) {
            console.error("Error deleting chatbot knowledge:", knowledgeError);
            return ServiceResponse.failure("Failed to delete chatbot knowledge", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // 2. Delete chatbot personas
        const { error: personaError } = await supabase
            .from("chatbot_personas")
            .delete()
            .eq("chatbot_id", chatbotId);

        if (personaError) {
            console.error("Error deleting chatbot personas:", personaError);
            return ServiceResponse.failure("Failed to delete chatbot personas", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // 3. Delete document chunks (if using different table)
        const { error: chunksError } = await supabase
            .from("document_chunks")
            .delete()
            .eq("chatbot_id", chatbotId);

        if (chunksError) {
            console.error("Error deleting document chunks:", chunksError);
            return ServiceResponse.failure("Failed to delete document chunks", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // 4. Delete the chatbot itself
        const { error: chatbotError } = await supabase
            .from("chatbots")
            .delete()
            .eq("id", chatbotId);

        if (chatbotError) {
            console.error("Error deleting chatbot:", chatbotError);
            return ServiceResponse.failure("Failed to delete chatbot", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return ServiceResponse.success("Chatbot and all associated data successfully deleted", { chatbotId });
    } catch (error) {
        console.error("Error deleting chatbot:", error);
        return ServiceResponse.failure("Failed to delete chatbot", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
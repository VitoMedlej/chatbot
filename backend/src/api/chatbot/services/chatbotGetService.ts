import { supabase } from "@/server";
import { ServiceResponse } from "@/common/models/serviceResponse";

/**
 * Fetches a chatbot by its ID from the database.
 * @param chatbotId - The ID of the chatbot to retrieve.
 * @returns A promise resolving to a ServiceResponse object.
 */
export const getChatbotById = async (chatbotId: number): Promise<ServiceResponse> => {
    if (!Number.isInteger(chatbotId) || chatbotId <= 0) {
        return ServiceResponse.failure("Valid chatbot ID is required.", null, 400);
    }

    try {
        const { data, error } = await supabase
            .from("chatbots")
            .select("*")
            .eq("id", chatbotId)
            .single();

        if (error || !data) {
            return ServiceResponse.failure("Chatbot not found.", null, 404);
        }

        return ServiceResponse.success("Chatbot retrieved successfully.", data);
    } catch (err) {
        console.error("Error fetching chatbot by ID:", err);
        return ServiceResponse.failure("Internal server error.", null, 500);
    }
};

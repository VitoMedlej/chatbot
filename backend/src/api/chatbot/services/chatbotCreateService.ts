import { ServiceResponse } from "@/common/models/serviceResponse";
import { supabase } from "@/server";



export async function createChatbotService(req: any): Promise<ServiceResponse<any>> {
    try {
        const { business_name, user_id } = req.body;

        // Validate input
        if (!business_name || typeof business_name !== "string" || business_name.length < 2) {
            return ServiceResponse.failure("Invalid or missing business_name", null);
        }
        if (!user_id || (typeof user_id !== "string" && typeof user_id !== "number")) {
            return ServiceResponse.failure("Invalid or missing user_id", null);
        }

        // Insert chatbot
        const { data, error } = await supabase
            .from("chatbots")
            .insert([{ business_name, user_id }])
            .select("id")
            .single();

        if (error) {
            if (error.code === "23505") {
                return ServiceResponse.failure("A chatbot with this name already exists.", null);
            }
            return ServiceResponse.failure("Database error: " + error.message, error);
        }

        if (!data || !data.id) {
            return ServiceResponse.failure("Failed to create chatbot. No ID returned.", null);
        }

        return ServiceResponse.success("Chatbot created successfully.", { id: data.id });
    } catch (err: any) {
        return ServiceResponse.failure("Unexpected error: " + (err?.message || "Unknown error"), err);
    }
}
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";
import { autoGeneratePersona } from "./autoGeneratePersonaService";



export async function createChatbotService(req: any): Promise<ServiceResponse<any>> {
    try {
        const { business_name, user_id } = req.body;

        // Validate input
        if (!business_name || typeof business_name !== "string" || business_name.length < 2) {
            return ServiceResponse.failure("Invalid or missing business_name", null);
        }
        if (!user_id || typeof user_id !== "string" || user_id.length < 8) {
            return ServiceResponse.failure("Invalid or missing user_id", null);
        }

        // Insert chatbot with user_id as UUID string
        const { data, error } = await supabase
            .from("chatbots")
            .insert([{ business_name, user_id }])
            .select("id")
            .single();

        if (error) {
            console.error("Supabase error:", error);
            if (error.code === "23505") {
                return ServiceResponse.failure("A chatbot with this name already exists.", null);
            }
            return ServiceResponse.failure("Database error: " + error.message, error);
        }

        if (!data || !data.id) {
            return ServiceResponse.failure("Failed to create chatbot. No ID returned.", null);
        }

        // After chatbot creation, scraping, and ingestion, auto-generate persona automatically
        await autoGeneratePersona({ body: { chatbotId: data.id, businessName: business_name } });

        return ServiceResponse.success("Chatbot created and persona auto-generated.", { id: data.id });
    } catch (err: any) {
        return ServiceResponse.failure("Unexpected error: " + (err?.message || "Unknown error"), err);
    }
}
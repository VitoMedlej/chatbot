import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

export async function updateChatbotService(req: any): Promise<ServiceResponse<any>> {
    try {
        const { id, name, avatar_url, logo_url, personality } = req.body;
        if (!id) {
            return ServiceResponse.failure("Missing chatbot id.", null, StatusCodes.BAD_REQUEST);
        }
        // Accept both string and number for id (UUID or numeric)
        let validId = id;
        if (typeof id === "number") {
            validId = id.toString();
        }
        if (typeof validId !== "string" || validId.length < 1) {
            return ServiceResponse.failure("Invalid chatbot id.", null, StatusCodes.BAD_REQUEST);
        }
        if (name !== undefined && (typeof name !== "string" || name.length < 2)) {
            return ServiceResponse.failure("Invalid chatbot name.", null, StatusCodes.BAD_REQUEST);
        }
        if (avatar_url !== undefined && typeof avatar_url !== "string") {
            return ServiceResponse.failure("Invalid avatar_url.", null, StatusCodes.BAD_REQUEST);
        }
        if (logo_url !== undefined && typeof logo_url !== "string") {
            return ServiceResponse.failure("Invalid logo_url.", null, StatusCodes.BAD_REQUEST);
        }
        if (personality !== undefined && !["friendly", "professional", "enthusiastic", "concise", "empathetic"].includes(personality)) {
            return ServiceResponse.failure("Invalid personality.", null, StatusCodes.BAD_REQUEST);
        }
        const updateObj: any = {};
        if (name) updateObj.name = name;
        if (avatar_url) updateObj.avatar_url = avatar_url;
        if (logo_url) updateObj.logo_url = logo_url;
        if (personality) updateObj.personality = personality;
        if (Object.keys(updateObj).length === 0) {
            return ServiceResponse.failure("No update fields provided.", null, StatusCodes.BAD_REQUEST);
        }
        const { error } = await supabase
            .from("chatbots")
            .update(updateObj)
            .eq("id", validId);
        if (error) {
            return ServiceResponse.failure(error.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        return ServiceResponse.success("Chatbot updated.", null);
    } catch (err: any) {
        return ServiceResponse.failure(err.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

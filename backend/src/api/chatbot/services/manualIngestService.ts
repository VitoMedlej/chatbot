import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

export async function ingestManualText(req: any): Promise<ServiceResponse<any>> {
    try {
        const { chatbotId, title, description, content } = req.body;
        if (!chatbotId || !content) {
            return ServiceResponse.failure("Missing chatbotId or content.", null, StatusCodes.BAD_REQUEST);
        }
        await supabase.from("chatbot_knowledge").insert([
            {
                chatbot_id: chatbotId,
                source_type: "manual",
                source_name: null,
                title,
                description,
                content,
                links: null,
                buttons: null,
                metadata: null
            }
        ]);
        return ServiceResponse.success("Manual text ingested.", null);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to ingest manual text.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
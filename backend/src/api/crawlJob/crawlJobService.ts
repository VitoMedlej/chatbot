import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";

export async function createCrawlJob(req: any): Promise<ServiceResponse<any>> {
    const { url, chatbotId, userId } = req.body;
    if (!url || !chatbotId || !userId) {
        return ServiceResponse.failure("Missing url, chatbotId, or userId", null, StatusCodes.BAD_REQUEST);
    }
    const { data, error } = await supabase.from("crawl_jobs").insert([
        { url, chatbot_id: chatbotId, user_id: userId }
    ]).select().single();
    if (error) {
        return ServiceResponse.failure(error.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
    return ServiceResponse.success("Crawl job created", data);
}

export async function getCrawlJobStatus(req: any): Promise<ServiceResponse<any>> {
    const { jobId } = req.params;
    if (!jobId) {
        return ServiceResponse.failure("Missing jobId", null, StatusCodes.BAD_REQUEST);
    }
    const { data, error } = await supabase.from("crawl_jobs").select("*").eq("id", jobId).single();
    if (error) {
        return ServiceResponse.failure(error.message, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
    return ServiceResponse.success("Crawl job status", data);
}
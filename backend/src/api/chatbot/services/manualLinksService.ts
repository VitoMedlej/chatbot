import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { crawlAndIngestWebsiteJob } from "./crawlAndIngestWebsiteService";

export async function ingestManualLinks(req: any): Promise<ServiceResponse<any>> {
    try {
        const { chatbotId, userId, links } = req.body;
        if (!chatbotId || !userId || !Array.isArray(links) || links.length === 0) {
            return ServiceResponse.failure("Missing chatbotId, userId, or links.", null, StatusCodes.BAD_REQUEST);
        }
        // You can now crawl and ingest these links as you do in crawlAndIngestWebsiteJob
        // Call crawlAndIngestWebsiteJob for these links
        const result = await crawlAndIngestWebsiteJob({
            url: links[0], // base url for fallback
            chatbotId,
            userId,
            selectedUrls: links
        });
        return result;
    } catch (err: any) {
        return ServiceResponse.failure("Failed to ingest manual links.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
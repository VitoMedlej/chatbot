import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { RequestHandler } from "express";
import { chatbotService } from "./chatbotService";
import { chatbotIngestService } from "./services/chatbotIngestService";
import { chatbotRagService } from "./services/chatbotRagService";
import { deleteChunks } from "./services/chatbotDeleteService";
import { listChunks } from "./services/chatbotListService"; // Import the new service
import { chatWithContext } from "./services/chatbotContextService";
import { extractWebsiteInfo } from "./services/websiteExtractService";
import { getAllLinksService, getSitemapLinksService } from "./services/websiteCrawlService";
import { crawlAndIngestWebsite } from "./services/crawlAndIngestWebsiteService";

class ChatbotController {
    directQuestionAnswer: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotService.directQuestionAnswer(req);
        return handleServiceResponse(serviceResponse, res);
    };

    ingestTextHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotIngestService.ingestText(req);
        return handleServiceResponse(serviceResponse, res);
    };

    retrieveAndAnswer: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotRagService.retrieveAndAnswer(req);
        return handleServiceResponse(serviceResponse, res);
    };

    deleteChunksHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await deleteChunks(req.body.chatbotId, req.body.chunkIds);
        return handleServiceResponse(serviceResponse, res);
    };

    listChunksHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await listChunks(req.body.chatbotId);
        return handleServiceResponse(serviceResponse, res);
    };

    chatWithContextHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await chatWithContext(req);
        return handleServiceResponse(serviceResponse, res);
    };

    extractWebsiteInfoHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await extractWebsiteInfo(req);
        return handleServiceResponse(serviceResponse, res);
    };

    websiteLinksHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await getAllLinksService(req);
        return handleServiceResponse(serviceResponse, res);
    };

    sitemapLinksHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await getSitemapLinksService(req);
        return handleServiceResponse(serviceResponse, res);
    };

    crawlAndIngestWebsiteHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await crawlAndIngestWebsite(req);
        return handleServiceResponse(serviceResponse, res);
    };
}

export const chatbotController = new ChatbotController();
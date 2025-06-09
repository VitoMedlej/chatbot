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
import { crawlAndIngestWebsiteJob } from "./services/crawlAndIngestWebsiteService";
import { autoGeneratePersona, upsertDefaultPersona } from "./services/autoGeneratePersonaService";
import { createChatbotService } from "./services/chatbotCreateService";
import { listUserChatbots } from "./services/listChatbotsService";
import { ingestManualLinks } from "./services/manualLinksService";
import { uploadFile } from "./services/fileUploadService";
import { generateQuestions } from "./services/generateQuestionsService"; // Import the new service
import { listKnowledgeSources } from "./services/chatbotListService";
import { supabase } from "@/server";
import { getChatbotById } from "./services/chatbotGetService";
import { ingestManualText } from "./services/manualIngestService";


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
        const serviceResponse = await crawlAndIngestWebsiteJob({
            url: req.body.url,
            chatbotId: req.body.chatbotId,
            userId: req.body.userId,
            fallbackUrls: req.body.fallbackUrls,
            selectedUrls: req.body.selectedUrls // <-- add this
        });
        return handleServiceResponse(serviceResponse, res);
    };

    autoGeneratePersonaHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await autoGeneratePersona(req);
        return handleServiceResponse(serviceResponse, res);
    };

    createChatbotHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await createChatbotService(req);
        return handleServiceResponse(serviceResponse, res);
    };

    listUserChatbotsHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await listUserChatbots(req);
        return handleServiceResponse(serviceResponse, res);
    };

    upsertDefaultPersonaHandler: RequestHandler = async (req, res) => {
        const { chatbotId, businessName } = req.body;
        const serviceResponse = await upsertDefaultPersona(chatbotId, businessName);
        return handleServiceResponse(serviceResponse, res);
    };

    ingestManualLinksHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await ingestManualLinks(req);
        return handleServiceResponse(serviceResponse, res);
    };

    uploadFileHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await uploadFile(req);
        return handleServiceResponse(serviceResponse, res);
    };

    generateQuestionsHandler: RequestHandler = async (req, res) => {
        const { chatbotId } = req.body;
        const serviceResponse = await generateQuestions(chatbotId);
        return handleServiceResponse(serviceResponse, res);
    };

    listKnowledgeSourcesHandler: RequestHandler = async (req, res) => {
        const chatbotId = req.params.chatbotId || req.body.chatbotId || req.query.chatbotId;

        const serviceResponse = await listKnowledgeSources(chatbotId);
        return handleServiceResponse(serviceResponse, res);
    };

    getChatbotByIdHandler: RequestHandler = async (req, res) => {
        const chatbotId = req.params.chatbotId;
        const serviceResponse = await getChatbotById(chatbotId);
        handleServiceResponse(serviceResponse, res);
    };

    manualIngestHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await ingestManualText(req);
        return handleServiceResponse(serviceResponse, res);
    };
}

export const chatbotController = new ChatbotController();

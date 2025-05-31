import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { RequestHandler } from "express";
import { chatbotService } from "./chatbotService";
import { chatbotIngestService } from "./services/chatbotIngestService";


class ChatbotController {
    directQuestionAnswer: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotService.directQuestionAnswer(req);
        return handleServiceResponse(serviceResponse, res);
    };

    ingestTextHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotIngestService.ingestText(req);
        return handleServiceResponse(serviceResponse, res);
    };
}

export const chatbotController = new ChatbotController();
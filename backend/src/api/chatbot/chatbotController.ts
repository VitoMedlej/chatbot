// filepath: c:\Users\Hp\Desktop\vitoz-code\chatbot\backend-express\src\api\chatbot\chatbotModel.ts
import { z } from "zod";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { RequestHandler } from "express";
import { chatbotService } from "./chatbotService";


class ChatbotController {
    directQuestionAnswer: RequestHandler = async (req, res) => {
        const serviceResponse = await chatbotService.directQuestionAnswer(req);
        return handleServiceResponse(serviceResponse, res);
    };
}

export const chatbotController = new ChatbotController();
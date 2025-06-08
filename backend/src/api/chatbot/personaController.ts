import { RequestHandler } from "express";
import { chatbotController } from "./chatbotController";

export const personaController = {
    autoGeneratePersonaHandler: chatbotController.autoGeneratePersonaHandler,
    createChatbotHandler: chatbotController.createChatbotHandler,
};

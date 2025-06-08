import { RequestHandler } from "express";
import { chatbotController } from "./chatbotController";

export const knowledgeController = {
    listChunksHandler: chatbotController.listChunksHandler,
    deleteChunksHandler: chatbotController.deleteChunksHandler,
};

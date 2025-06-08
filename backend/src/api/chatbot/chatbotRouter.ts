import express from "express";
import multer from "multer";
import { chatbotController } from "./chatbotController";
import { personaRouter } from "./personaRouter";
import { fileRouter } from "./fileRouter";
import { knowledgeRouter } from "./knowledgeRouter";
import { websiteRouter } from "./websiteRouter";


export const chatbotRouter = express.Router();

chatbotRouter.post("/direct-qa", chatbotController.directQuestionAnswer);
chatbotRouter.post("/ingest-text", chatbotController.ingestTextHandler);
chatbotRouter.post("/rag-qa", chatbotController.retrieveAndAnswer);
chatbotRouter.delete("/chunks", chatbotController.deleteChunksHandler);
chatbotRouter.post("/list-chunks", chatbotController.listChunksHandler);
chatbotRouter.post("/chat-context", chatbotController.chatWithContextHandler);
chatbotRouter.post("/generate-questions", chatbotController.generateQuestionsHandler);
chatbotRouter.get("/:chatbotId/sources", chatbotController.listKnowledgeSourcesHandler);
chatbotRouter.get("/:chatbotId/sources/all", chatbotController.listKnowledgeSourcesHandler);
chatbotRouter.get("/list", chatbotController.listUserChatbotsHandler);
chatbotRouter.get("/:chatbotId", chatbotController.getChatbotByIdHandler);

chatbotRouter.use("/persona", personaRouter);
chatbotRouter.use("/file", fileRouter);
chatbotRouter.use("/knowledge", knowledgeRouter);
chatbotRouter.use("/website", websiteRouter);
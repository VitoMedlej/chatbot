import express from "express";
import multer from "multer";
import { chatbotController } from "./chatbotController";
import { personaRouter } from "./personaRouter";
import { fileRouter } from "./fileRouter";
import { knowledgeRouter } from "./knowledgeRouter";
import { websiteRouter } from "./websiteRouter";
import { validateChatbotOwnership } from "../../common/middleware/authorizationHandler";

export const chatbotRouter = express.Router();

// Routes that don't require chatbot ownership validation
chatbotRouter.post("/direct-qa", chatbotController.directQuestionAnswer);
chatbotRouter.post("/create", chatbotController.createChatbotHandler);
chatbotRouter.get("/list", chatbotController.listUserChatbotsHandler);

// Routes that require chatbot ownership validation
chatbotRouter.post("/ingest-text", validateChatbotOwnership, chatbotController.ingestTextHandler);
chatbotRouter.post("/rag-qa", validateChatbotOwnership, chatbotController.retrieveAndAnswer);
chatbotRouter.delete("/chunks", validateChatbotOwnership, chatbotController.deleteChunksHandler);
chatbotRouter.post("/list-chunks", validateChatbotOwnership, chatbotController.listChunksHandler);
chatbotRouter.post("/chat-context", validateChatbotOwnership, chatbotController.chatWithContextHandler);
chatbotRouter.post("/generate-questions", validateChatbotOwnership, chatbotController.generateQuestionsHandler);
chatbotRouter.get("/:chatbotId/sources", validateChatbotOwnership, chatbotController.listKnowledgeSourcesHandler);
chatbotRouter.get("/:chatbotId/sources/all", validateChatbotOwnership, chatbotController.listKnowledgeSourcesHandler);
chatbotRouter.get("/:chatbotId", validateChatbotOwnership, chatbotController.getChatbotByIdHandler);
chatbotRouter.post("/manual-ingest", validateChatbotOwnership, chatbotController.manualIngestHandler);
chatbotRouter.post("/update", validateChatbotOwnership, chatbotController.updateChatbotHandler);

// Sub-routers with ownership validation
chatbotRouter.use("/persona", validateChatbotOwnership, personaRouter);
chatbotRouter.use("/file", validateChatbotOwnership, fileRouter);
chatbotRouter.use("/knowledge", validateChatbotOwnership, knowledgeRouter);
chatbotRouter.use("/website", validateChatbotOwnership, websiteRouter);
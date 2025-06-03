import express from "express";
import { chatbotController } from "./chatbotController";

export const chatbotRouter = express.Router();

chatbotRouter.post("/direct-qa", chatbotController.directQuestionAnswer);
chatbotRouter.post("/ingest-text", chatbotController.ingestTextHandler);
chatbotRouter.post("/rag-qa", chatbotController.retrieveAndAnswer);
chatbotRouter.delete("/chunks", chatbotController.deleteChunksHandler);
chatbotRouter.post("/list-chunks", chatbotController.listChunksHandler);
chatbotRouter.post("/chat-context", chatbotController.chatWithContextHandler);
chatbotRouter.post("/website-links", chatbotController.websiteLinksHandler);
chatbotRouter.post("/sitemap-links", chatbotController.sitemapLinksHandler);
chatbotRouter.post("/extract-website", chatbotController.extractWebsiteInfoHandler);
chatbotRouter.post("/crawl-and-ingest", chatbotController.crawlAndIngestWebsiteHandler);
chatbotRouter.post("/auto-generate-persona", chatbotController.autoGeneratePersonaHandler);
chatbotRouter.post("/create", chatbotController.createChatbotHandler);
import express from "express";
import { chatbotController } from "./chatbotController";

export const chatbotRouter = express.Router();

chatbotRouter.post("/direct-qa", chatbotController.directQuestionAnswer);
chatbotRouter.post("/ingest-text", chatbotController.ingestTextHandler);
chatbotRouter.post("/rag-qa", chatbotController.retrieveAndAnswer);
chatbotRouter.delete("/chunks", chatbotController.deleteChunksHandler);
chatbotRouter.post("/list-chunks", chatbotController.listChunksHandler);

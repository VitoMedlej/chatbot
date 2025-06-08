import express from "express";
import { chatbotController } from "./chatbotController";

export const knowledgeRouter = express.Router();

knowledgeRouter.post("/list-chunks", chatbotController.listChunksHandler);
knowledgeRouter.delete("/chunks", chatbotController.deleteChunksHandler);

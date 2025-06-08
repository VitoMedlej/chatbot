import express from "express";
import { chatbotController } from "./chatbotController";

export const fileRouter = express.Router();

fileRouter.post("/ingest-text", chatbotController.ingestTextHandler);

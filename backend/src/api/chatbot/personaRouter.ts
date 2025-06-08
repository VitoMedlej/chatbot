import express from "express";
import { chatbotController } from "./chatbotController";

export const personaRouter = express.Router();

personaRouter.post("/auto-generate-persona", chatbotController.autoGeneratePersonaHandler);
personaRouter.post("/create", chatbotController.createChatbotHandler);

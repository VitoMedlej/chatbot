import express from "express";
import { chatbotController } from "./chatbotController";

export const chatbotRouter = express.Router();

chatbotRouter.post("/direct-qa", chatbotController.directQuestionAnswer);

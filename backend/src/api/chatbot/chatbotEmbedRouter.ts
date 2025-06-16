import express from "express";
import { chatbotEmbedController } from "./chatbotEmbedController";
import rateLimit from "express-rate-limit";

export const chatbotEmbedRouter = express.Router();

// Stricter rate limiting for public endpoints
const publicChatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 requests per minute per IP (on top of per-API-key limiting)
    message: {
        error: "Too many requests from this IP, please try again later",
        retryAfter: "1 minute"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public endpoints (no authentication required, but API key validated)
chatbotEmbedRouter.post("/chat", publicChatLimiter, chatbotEmbedController.publicChat);
chatbotEmbedRouter.get("/config", chatbotEmbedController.getChatbotConfig);

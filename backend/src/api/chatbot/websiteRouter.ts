import express from "express";
import { chatbotController } from "./chatbotController";

export const websiteRouter = express.Router();

websiteRouter.post("/website-links", chatbotController.websiteLinksHandler);
websiteRouter.post("/sitemap-links", chatbotController.sitemapLinksHandler);
websiteRouter.post("/extract-website", chatbotController.extractWebsiteInfoHandler);
websiteRouter.post("/crawl-and-ingest", chatbotController.crawlAndIngestWebsiteHandler);

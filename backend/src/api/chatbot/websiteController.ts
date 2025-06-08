import { RequestHandler } from "express";
import { chatbotController } from "./chatbotController";

export const websiteController = {
    extractWebsiteInfoHandler: chatbotController.extractWebsiteInfoHandler,
    websiteLinksHandler: chatbotController.websiteLinksHandler,
    sitemapLinksHandler: chatbotController.sitemapLinksHandler,
    crawlAndIngestWebsiteHandler: chatbotController.crawlAndIngestWebsiteHandler,
};

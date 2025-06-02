import express from "express";
import { crawlJobController } from "./crawlJobController";

export const crawlJobRouter = express.Router();

crawlJobRouter.post("/start-crawl", crawlJobController.createCrawlJobHandler);
crawlJobRouter.get("/crawl-status/:jobId", crawlJobController.getCrawlJobStatusHandler);
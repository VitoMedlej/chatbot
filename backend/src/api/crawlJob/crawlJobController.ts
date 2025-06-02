import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { RequestHandler } from "express";
import { createCrawlJob, getCrawlJobStatus } from "./crawlJobService";

class CrawlJobController {
    createCrawlJobHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await createCrawlJob(req);
        return handleServiceResponse(serviceResponse, res);
    };

    getCrawlJobStatusHandler: RequestHandler = async (req, res) => {
        const serviceResponse = await getCrawlJobStatus(req);
        return handleServiceResponse(serviceResponse, res);
    };
}

export const crawlJobController = new CrawlJobController();
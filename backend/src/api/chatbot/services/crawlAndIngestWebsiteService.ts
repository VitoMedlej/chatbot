import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { supabase, openai } from "@/server";
import { chunkText } from "@/utils/chunkText";
import { ingestText } from "./chatbotIngestService";
import { parseStringPromise } from "xml2js";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function crawlAndIngestWebsiteJob(job: {
    url: string,
    chatbotId: string,
    userId: string,
    fallbackUrls?: string[],
    selectedUrls?: string[]
}): Promise<ServiceResponse<any>> {
    const { url: rootUrl, chatbotId, userId, fallbackUrls, selectedUrls } = job;
    if (!rootUrl || typeof rootUrl !== "string" || !chatbotId || !userId) {
        return ServiceResponse.failure("Missing or invalid URL or chatbotId or userId.", null, StatusCodes.BAD_REQUEST);
    }

    const crawledUrls = new Set<string>();
    const processedContentUrls = new Set<string>();
    let pagesCrawledCount = 0;
    let chunksIngestedCount = 0;
    let errors: any[] = [];

    try {
        let urlsToProcess: string[] = [];
        const baseUrl = rootUrl;

        if (Array.isArray(selectedUrls) && selectedUrls.length > 0) {
            urlsToProcess = selectedUrls;
        } else {
            // Try sitemap.xml
            let urlsFromSitemap: string[] = [];
            try {
                const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
                const sitemapRes = await fetch(sitemapUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                if (sitemapRes.ok) {
                    const sitemapXml = await sitemapRes.text();
                    const parsedSitemap = await parseStringPromise(sitemapXml);
                    if (parsedSitemap.urlset && parsedSitemap.urlset.url) {
                        for (const u of parsedSitemap.urlset.url) {
                            if (u.loc && u.loc[0]) urlsFromSitemap.push(u.loc[0]);
                        }
                    }
                }
            } catch (err: any) {
                errors.push({ type: "sitemap", url: baseUrl, error: err.message || err });
            }
            // Fallback: homepage links
            if (urlsFromSitemap.length === 0) {
                try {
                    const homeRes = await fetch(baseUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                    if (homeRes.ok) {
                        const homeHtml = await homeRes.text();
                        const homeDom = new JSDOM(homeHtml, { url: baseUrl });
                        const anchors = Array.from(homeDom.window.document.querySelectorAll("a"));
                        const base = new URL(baseUrl);
                        const links = anchors
                            .map(a => a.href ? new URL(a.href, base).href : "")
                            .filter(href => href.startsWith("http") && href.includes(base.hostname));
                        urlsFromSitemap = links;
                    }
                } catch (err: any) {
                    errors.push({ type: "homepage", url: baseUrl, error: err.message || err });
                }
            }
            urlsToProcess = Array.from(new Set([baseUrl, ...urlsFromSitemap]));
        }

        if (urlsToProcess.length === 0) {
            return ServiceResponse.failure(
                "No URLs found to crawl. Please provide a list of URLs to crawl.",
                { askForUrls: true, errors },
                StatusCodes.NOT_FOUND
            );
        }

        // --- Step 2: Process Each Unique URL ---
        for (const pageUrl of urlsToProcess) {
            await delay(500);
            try {
                const pageRes = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                if (!pageRes.ok) {
                    errors.push({ type: "page", url: pageUrl, error: `HTTP ${pageRes.status}` });
                    continue;
                }
                const pageHtml = await pageRes.text();
                const pageDom = new JSDOM(pageHtml, { url: pageUrl });
                const doc = pageDom.window.document;
                const title = doc.title || pageUrl;

                // Extract main readable content for RAG
                let content = "";
                let article: any = null;
                try {
                    const reader = new Readability(doc);
                    article = reader.parse();
                    content = article?.textContent || "";
                } catch (err: any) {
                    content = doc.body?.textContent || "";
                    errors.push({ type: "readability", url: pageUrl, error: err.message || err });
                }
                if (!content.trim()) {
                    errors.push({ type: "content", url: pageUrl, error: "No significant content extracted" });
                    continue;
                }

                // --- Send content to RAG pipeline (ingestText) ---
                const ingestReq = {
                    body: {
                        text: String(content),
                        chatbotId: chatbotId,
                        userId: userId,
                        source_url: pageUrl,
                        title,
                        links: [], // Optionally extract links/buttons as above
                        buttons: []
                    }
                } as any;

                const ingestResponse = await ingestText(ingestReq);
                if (!ingestResponse.success) {
                    errors.push({ type: "embedding", url: pageUrl, error: ingestResponse.message });
                    continue;
                }
                pagesCrawledCount++;
                chunksIngestedCount += 1;
                processedContentUrls.add(pageUrl);
            } catch (pageErr: any) {
                errors.push({ type: "page", url: pageUrl, error: pageErr.message || pageErr });
                continue;
            }
        }

        if (pagesCrawledCount === 0) {
            return ServiceResponse.failure(
                "No valid pages were crawled and embedded. Please provide a list of URLs to crawl.",
                { askForUrls: true, errors },
                StatusCodes.NOT_FOUND
            );
        }

        return ServiceResponse.success(
            `Website crawl completed. ${pagesCrawledCount} pages processed, ${chunksIngestedCount} chunks ingested.`,
            { crawledUrls: Array.from(processedContentUrls), pagesProcessed: pagesCrawledCount, chunksIngested: chunksIngestedCount, errors }
        );
    } catch (err: any) {
        return ServiceResponse.failure(`Failed to crawl and ingest website: ${err.message}`, { errors }, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
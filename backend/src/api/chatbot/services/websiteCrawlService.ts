import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { supabase } from "@/server"; // Import supabase client

// Get all internal links from a page
export async function getAllLinksService(req: any): Promise<ServiceResponse<null | string[]>> {
    try {
        const { url } = req.body;
        if (!url || typeof url !== "string") {
            return ServiceResponse.failure("Missing or invalid url.", null, StatusCodes.BAD_REQUEST);
        }
        const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) {
            return ServiceResponse.failure(`Failed to fetch URL: ${response.statusText}`, null, StatusCodes.BAD_GATEWAY);
        }
        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const anchors = Array.from(dom.window.document.querySelectorAll("a"));
        const base = new URL(url);
        const links = anchors
            .map(a => a.href)
            .filter(href =>
                href.startsWith("http") && href.includes(base.hostname)
            );
        // Remove duplicates
        const uniqueLinks = Array.from(new Set(links));
        return ServiceResponse.success("Links extracted.", uniqueLinks);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to extract links.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Get all URLs from sitemap.xml
export async function getSitemapLinksService(req: any): Promise<ServiceResponse<null | string[]>> {
    try {
        const { url } = req.body;
        if (!url || typeof url !== "string") {
            return ServiceResponse.failure("Missing or invalid url.", null, StatusCodes.BAD_REQUEST);
        }
        const base = new URL(url);
        const sitemapUrl = `${base.origin}/sitemap.xml`;
        const response = await fetch(sitemapUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) {
            return ServiceResponse.failure(`Failed to fetch sitemap.xml: ${response.statusText}`, null, StatusCodes.BAD_GATEWAY);
        }
        const xml = await response.text();
        const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map(match => match[1]);
        return ServiceResponse.success("Sitemap links extracted.", urls);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to extract sitemap links.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Function to insert document chunk into the database
export async function insertDocumentChunk(chatbotId: string, chunkText: string, embedding: number[], url: string, pageTitle: string, linksArray: string[]) {
    try {
        await supabase.from('document_chunks').insert({
            chatbot_id: chatbotId,
            content: chunkText, // from chunking the page content
            embedding: embedding, // from OpenAI
            source_url: url,
            title: pageTitle,
            links: JSON.stringify(linksArray)
        });
    } catch (err: any) {
        console.error("Error inserting document chunk:", err);
    }
}
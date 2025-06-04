import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import { supabase } from "@/server";
import { parseStringPromise } from "xml2js";

function cleanUrl(url: string): string {
    try {
        const u = new URL(url);
        u.hash = ""; // Remove fragment
        u.search = ""; // Optionally remove query params
        return u.toString();
    } catch {
        return url;
    }
}

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
                href.startsWith("http") &&
                href.includes(base.hostname) &&
                !href.includes("#") // Remove fragments
            )
            .map(cleanUrl);
        // Remove duplicates
        const uniqueLinks = Array.from(new Set(links));
        return ServiceResponse.success("Links extracted.", uniqueLinks);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to extract links.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

async function fetchAllSitemapLinks(sitemapUrl: string, visited = new Set<string>()): Promise<string[]> {
    if (visited.has(sitemapUrl)) return [];
    visited.add(sitemapUrl);

    const links: string[] = [];
    try {
        const response = await fetch(sitemapUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) return [];
        const xml = await response.text();
        const parsed = await parseStringPromise(xml);

        // If sitemap index, recurse
        if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
            for (const sitemap of parsed.sitemapindex.sitemap) {
                if (sitemap.loc && sitemap.loc[0]) {
                    const nestedLinks = await fetchAllSitemapLinks(sitemap.loc[0], visited);
                    links.push(...nestedLinks);
                }
            }
        }
        // If regular sitemap, collect all <loc>
        if (parsed.urlset && parsed.urlset.url) {
            for (const urlEntry of parsed.urlset.url) {
                if (urlEntry.loc && urlEntry.loc[0]) {
                    links.push(urlEntry.loc[0]);
                }
            }
        }
    } catch (err) {
        // Ignore errors, just return what we have
    }
    return links;
}

// Robust sitemap fetch with fallback to homepage links
export async function getSitemapLinksService(req: any): Promise<ServiceResponse<null | string[]>> {
    try {
        const { url } = req.body;
        if (!url || typeof url !== "string") {
            return ServiceResponse.failure("Missing or invalid url.", null, StatusCodes.BAD_REQUEST);
        }
        const base = new URL(url);
        const sitemapUrl = `${base.origin}/sitemap.xml`;

        let urls: string[] = await fetchAllSitemapLinks(sitemapUrl);

        // Fallback: homepage links
        if (!urls.length) {
            try {
                const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
                if (response.ok) {
                    const html = await response.text();
                    const dom = new JSDOM(html, { url });
                    const anchors = Array.from(dom.window.document.querySelectorAll("a"));
                    const base = new URL(url);
                    urls = anchors
                        .map(a => a.href)
                        .filter(href =>
                            href.startsWith("http") && href.includes(base.hostname)
                        );
                    urls = Array.from(new Set(urls));
                }
            } catch {}
        }

        if (!urls.length) {
            return ServiceResponse.failure("No links found in sitemap.xml or homepage.", null, StatusCodes.NOT_FOUND);
        }

        // Deduplicate
        urls = Array.from(new Set(urls));
        return ServiceResponse.success("Sitemap or homepage links extracted.", urls);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to extract sitemap links.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

// Function to insert document chunk into the database
export async function insertDocumentChunk(chatbotId: string, chunkText: string, embedding: number[], url: string, pageTitle: string, linksArray: string[]) {
    try {
        await supabase.from('document_chunks').insert({
            chatbot_id: chatbotId,
            content: String(chunkText), // Always save as string
            embedding: embedding, // Always array of floats
            source_url: url,
            title: pageTitle,
            links: JSON.stringify(linksArray)
        });
    } catch (err: any) {
        console.error("Error inserting document chunk:", err);
    }
}
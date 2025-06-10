import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { supabase } from "@/server";
import { ingestText } from "./chatbotIngestService";
import { Request } from "express";

export async function extractWebsiteInfo(req: any): Promise<ServiceResponse<any>> {
    try {
        const { url, chatbotId, userId } = req.body; // userId is now expected

        if (!url || typeof url !== "string" || !chatbotId) {
            return ServiceResponse.failure("Missing or invalid url or chatbotId.", null, StatusCodes.BAD_REQUEST);
        }
        // Add validation for userId
        if (!userId) {
            return ServiceResponse.failure("Missing userId.", null, StatusCodes.BAD_REQUEST);
        }

        const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!response.ok) {
            return ServiceResponse.failure(`Failed to fetch URL: ${response.statusText}`, null, StatusCodes.BAD_GATEWAY);
        }

        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const doc = dom.window.document;

        const reader = new Readability(doc);
        const article = reader.parse();

        const anchors = Array.from(doc.querySelectorAll("a"))
            .map(a => ({
                text: a.textContent?.trim() || "",
                href: a.href
            }))
            .filter(a => a.href && a.text);
        
        const buttons = Array.from(doc.querySelectorAll("button,input[type='button'],input[type='submit']"))
            .map(b => ({
                text: b.textContent?.trim() || b.getAttribute("value") || "",
                action: b.getAttribute("onclick") || ""
            }))
            .filter(b => b.text);

        // Deduplicate: check if content already exists for this chatbot and url
        const content = article?.textContent || "";
        const { data: existing, error: existingError } = await supabase
            .from("chatbot_knowledge")
            .select("id")
            .eq("chatbot_id", chatbotId)
            .eq("source_name", url)
            .eq("content", content);
        if (existingError) {
            return ServiceResponse.failure("Failed to check for duplicates.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        if (existing && existing.length > 0) {
            return ServiceResponse.success("Duplicate content detected. Skipping ingestion.", null);
        }

        const extractionResult = {
            url,
            title: article?.title || doc.title || "Untitled", // Fallback title
            description: article?.excerpt || "",
            content,
            links: anchors,
            buttons: buttons
        };

        // Insert into chatbot_knowledge
        const { data: inserted, error: knowledgeError } = await supabase.from("chatbot_knowledge").insert([
            {
                chatbot_id: chatbotId,
                user_id: userId,
                source_type: "website",
                source_name: extractionResult.url,
                title: extractionResult.title,
                description: extractionResult.description,
                content: extractionResult.content,
                links: extractionResult.links,
                buttons: extractionResult.buttons,
                metadata: null
            }
        ]).select();

        if (knowledgeError) {
            console.error("Error inserting into chatbot_knowledge:", knowledgeError);
            return ServiceResponse.failure(`Failed to save knowledge: ${knowledgeError.message}`, null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // If knowledge insertion is successful, proceed to ingest text for embeddings
        if (extractionResult.content && extractionResult.content.trim() !== "") {
            const ingestReqBody = {
                text: extractionResult.content,
                chatbotId: chatbotId,
                userId: userId,
                source_url: extractionResult.url,
                title: extractionResult.title,
                links: extractionResult.links,
                buttons: extractionResult.buttons
            };

            const mockIngestReq = {
                body: ingestReqBody
            } as Request;

            const ingestResponse = await ingestText(mockIngestReq);

            if (!ingestResponse.success) {
                // Rollback: delete the just-inserted chatbot_knowledge row
                if (inserted && inserted[0] && inserted[0].id) {
                    await supabase.from("chatbot_knowledge").delete().eq("id", inserted[0].id);
                }
                console.warn("Website info saved to knowledge base, but failed to ingest text for embeddings:", ingestResponse.message);
                return ServiceResponse.failure(
                    "Website info extracted but embedding failed. Rolled back knowledge base entry.",
                    extractionResult
                );
            } else {
                 return ServiceResponse.success(
                    "Website info extracted, saved to knowledge base, and submitted for embedding.",
                    extractionResult
                );
            }
        } else {
            return ServiceResponse.success(
                "Website info extracted and saved to knowledge base. No content found to embed.",
                extractionResult
            );
        }

    } catch (err: any) {
        console.error("Error in extractWebsiteInfo:", err);
        return ServiceResponse.failure(`Failed to extract website info: ${err.message}`, null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
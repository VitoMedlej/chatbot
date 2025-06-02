import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { supabase } from "@/server";

export async function extractWebsiteInfo(req: any): Promise<ServiceResponse<any>> {
    try {
        const { url, chatbotId } = req.body;
        if (!url || typeof url !== "string" || !chatbotId) {
            return ServiceResponse.failure("Missing or invalid url or chatbotId.", null, StatusCodes.BAD_REQUEST);
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

        const extraction = ServiceResponse.success("Website info extracted.", {
            url,
            title: article?.title || doc.title,
            description: article?.excerpt || "",
            content: article?.textContent || "",
            links: anchors,
            buttons: buttons
        });

        if (extraction.success && extraction.responseObject) {
            const { url, title, description, content, links, buttons } = extraction.responseObject;
            await supabase.from("chatbot_knowledge").insert([
                {
                    chatbot_id: chatbotId,
                    source_type: "website",
                    source_name: url,
                    title,
                    description,
                    content,
                    links,
                    buttons,
                    metadata: null
                }
            ]);
        }

        return extraction;
    } catch (err: any) {
        return ServiceResponse.failure("Failed to extract website info.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
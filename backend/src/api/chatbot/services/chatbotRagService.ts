import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { openai, supabase } from "@/server";

const GPT_MODEL = "gpt-4o-mini";
const TOP_K = 8;

async function retrieveAndAnswer(req: Request): Promise<ServiceResponse<null | { answer: string }>> {
    try {
        const { question, chatbotId } = req.body;
        if (!question || !chatbotId) {
            return ServiceResponse.failure("Missing question or chatbotId.", null, StatusCodes.BAD_REQUEST);
        }

        // Fetch chatbot persona/instructions
        const { data: chatbotInfo } = await supabase
            .from("chatbots")
            .select("business_name,persona,instructions")
            .eq("id", chatbotId)
            .single();

        // 1. Embed the question
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: question,
        });
        const questionEmbedding = embeddingResponse.data[0].embedding;

        // 2. Query Supabase for similar knowledge chunks
        const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: questionEmbedding,
            match_threshold: 0.78,
            match_count: TOP_K,
            chatbot_id: Number(chatbotId),
        });

        if (error) {
            return ServiceResponse.failure("Vector search failed.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Build context with links/buttons/titles
        const context = (chunks ?? [])
            .map((c: any) => {
                let meta = "";
                if (c.title) meta += `Title: ${c.title}\n`;
                if (c.source_url) meta += `URL: ${c.source_url}\n`;
                if (c.links && c.links.length) meta += `Links: ${JSON.stringify(c.links)}\n`;
                if (c.buttons && c.buttons.length) meta += `Buttons: ${JSON.stringify(c.buttons)}\n`;
                return `${meta}Content: ${c.content}`;
            })
            .join("\n---\n")
            .slice(0, 8000);

        // 3. Ask GPT-4o-mini with context and persona
        const systemPrompt =
            (chatbotInfo?.instructions ||
                `You are the official chatbot for ${chatbotInfo?.business_name || "this business"}.
Be concise and helpful. Only be detailed if the user asks for details.
Never say you are ChatGPT. Always answer as a representative of ${chatbotInfo?.business_name || "this business"}.`);

        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
            ],
            max_tokens: 512,
            temperature: 0.2,
        });

        const answer = completion.choices?.[0]?.message?.content ?? "No answer generated.";
        return ServiceResponse.success("Answer generated", { answer });
    } catch (err: any) {
        return ServiceResponse.failure("Failed to answer question.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotRagService = { retrieveAndAnswer };
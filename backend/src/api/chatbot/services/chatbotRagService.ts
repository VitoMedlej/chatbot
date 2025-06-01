import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { openai, supabase, logger } from "@/server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const GPT_MODEL = "gpt-4o-mini";
const TOP_K = 5;

async function retrieveAndAnswer(req: Request): Promise<ServiceResponse<null | { answer: string }>> {
    try {
        const { question, chatbotId } = req.body;
        console.log("[RAG] Incoming question:", question);
        console.log("[RAG] Incoming chatbotId:", chatbotId, "(type:", typeof chatbotId, ")");

        if (!question || !chatbotId) {
            console.log("[RAG] Missing question or chatbotId");
            return ServiceResponse.failure("Missing question or chatbotId.", null, StatusCodes.BAD_REQUEST);
        }

        // 1. Embed the question
        const embeddingResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: question,
        });
        const questionEmbedding = embeddingResponse.data[0].embedding;
        console.log("[RAG] Question embedding type:", typeof questionEmbedding, "length:", questionEmbedding.length);

        // 2. Query Supabase for similar chunks
        console.log("[RAG] Supabase RPC params:", {
            query_embedding: Array.isArray(questionEmbedding) ? `[array of length ${questionEmbedding.length}]` : typeof questionEmbedding,
            match_threshold: 0.78,
            match_count: TOP_K,
            chatbot_id: Number(chatbotId),
        });

        const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
            query_embedding: questionEmbedding,
            match_threshold: 0.78,
            match_count: TOP_K,
            chatbot_id: Number(chatbotId),
        });

        console.log("[RAG] Supabase RPC error:", error ? error.message : "none");
        console.log("[RAG] Supabase RPC data type:", typeof chunks, "value:", chunks);

        if (error) {
            console.log("[RAG] Supabase vector search error:", error.message);
            return ServiceResponse.failure("Vector search failed.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        const context = (chunks ?? [])
            .map((c: any) => c.content)
            .join("\n---\n")
            .slice(0, 1000);

        console.log("[RAG] Context sent to GPT-4o-mini (length:", context.length, "):", context.substring(0, 200), context.length > 200 ? "..." : "");

        // 3. Ask GPT-4o-mini with context
        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: "system", content: "You are a helpful assistant. Use the provided context to answer the question." },
                { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
            ],
            max_tokens: 512,
            temperature: 0.2,
        });

        console.log("[RAG] GPT-4o-mini completion:", completion);

        const answer = completion.choices?.[0]?.message?.content ?? "No answer generated.";
        console.log("[RAG] Final answer:", answer);

        return ServiceResponse.success("Answer generated", { answer });
    } catch (err: any) {
        console.log("[RAG] Error in retrieveAndAnswer:", err.message);
        console.log("[RAG] Stack:", err.stack);
        return ServiceResponse.failure("Failed to answer question.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotRagService = { retrieveAndAnswer };
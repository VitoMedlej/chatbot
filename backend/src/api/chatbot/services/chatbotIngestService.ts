import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { chunkText } from "@/utils/chunkText";
import { supabase, logger, openai } from "@/server";

async function ingestText(req: Request): Promise<ServiceResponse<null>> {
    try {
        const { text, chatbotId, userId } = req.body;
        console.log("[ingestText] Received request", { chatbotId, textLength: text?.length });

        if (!text || !chatbotId || !userId) {
            console.log("[ingestText] Missing text or chatbotId or userId");
            return ServiceResponse.failure("Missing text or chatbot id or user id in request body.", null, StatusCodes.BAD_REQUEST);
        }

        const chunks = chunkText(text);
        console.log(`[ingestText] Chunked text into ${chunks.length} chunks`);

        const { error: deleteError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('chatbot_id', chatbotId);

        if (deleteError) {
            logger.error('Supabase delete error (ingest-text): ' + deleteError.message);
            console.log("[ingestText] Supabase delete error:", deleteError.message);
        } else {
            console.log("[ingestText] Existing chunks deleted for chatbot_id:", chatbotId);
        }

        const embeddingPromises: Promise<any>[] = [];
        let openaiQuotaExceeded = false;

        for (const [idx, chunk] of chunks.entries()) {
            if (chunk.length === 0) continue;
            if (openaiQuotaExceeded) {
                console.log(`[ingestText] Quota exceeded, breaking at chunk ${idx}`);
                break;
            }

            embeddingPromises.push(
                (async () => {
                    try {
                        console.log(`[ingestText] Requesting embedding for chunk ${idx} (length: ${chunk.length})`);
                        const embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-3-small",
                            input: chunk,
                        });
                        const embedding = embeddingResponse.data[0].embedding;

                        const { error: insertError } = await supabase
                            .from('document_chunks')
                            .insert({
                                content: chunk,
                                embedding: embedding,
                                chatbot_id: chatbotId,
                                user_id: userId || "system", 
                            });

                        if (insertError) {
                            logger.error('Supabase insert error (ingest-text): ' + insertError.message);
                            console.log(`[ingestText] Supabase insert error for chunk ${idx}:`, insertError.message);
                        } else {
                            console.log(`[ingestText] Inserted chunk ${idx} into Supabase`);
                        }
                    } catch (embedOrInsertError: any) {
                        // If OpenAI quota exceeded, set flag and log only once
                        if (
                            embedOrInsertError.status === 429 ||
                            (embedOrInsertError.message && embedOrInsertError.message.includes("quota"))
                        ) {
                            if (!openaiQuotaExceeded) {
                                logger.error(
                                    "OpenAI quota exceeded. Halting further embedding requests until resolved."
                                );
                                console.log("[ingestText] OpenAI quota exceeded at chunk", idx);
                            }
                            openaiQuotaExceeded = true;
                        } else {
                            logger.error(
                                'Error during embedding generation or insertion: ' +
                                (embedOrInsertError.message || embedOrInsertError)
                            );
                            console.log(`[ingestText] Error during embedding/insertion for chunk ${idx}:`, embedOrInsertError.message || embedOrInsertError);
                        }
                    }
                })()
            );
        }

        await Promise.all(embeddingPromises);

        if (openaiQuotaExceeded) {
            console.log("[ingestText] Returning quota exceeded response");
            return ServiceResponse.failure(
                "OpenAI quota exceeded. Please check your plan and billing details.",
                null,
                StatusCodes.TOO_MANY_REQUESTS
            );
        }

        console.log(`[ingestText] Successfully processed all chunks for chatbot ${chatbotId}`);
        return ServiceResponse.success(`Text ingested and processed for chatbot ${chatbotId}.`, null);
    } catch (err: any) {
        logger.error('Unhandled error during text ingestion: ' + err.message);
        console.log("[ingestText] Unhandled error:", err.message);
        return ServiceResponse.failure('Failed to process text.', null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotIngestService = {
    ingestText,
};
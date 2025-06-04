// Accepts user_id as UUID (string) or number, and inserts it as-is into document_chunks

import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { chunkText } from "@/utils/chunkText";
import { supabase, logger, openai } from "@/server";

export async function ingestText(req: Request): Promise<ServiceResponse<null>> {
    try {
        const { text, chatbotId, userId } = req.body;

        if (!text || !chatbotId || !userId) {
            return ServiceResponse.failure("Missing text, chatbot id, or user id in request body.", null, StatusCodes.BAD_REQUEST);
        }

        // Accept userId as string (UUID) or number, and insert as-is
        const validUserId =
            (typeof userId === "string" && userId.length >= 8) || typeof userId === "number"
                ? userId
                : null;

        if (!validUserId) {
            console.error('Missing or invalid userId for document_chunks insert', { userId });
            return ServiceResponse.failure('Missing or invalid userId for document_chunks insert', null, StatusCodes.BAD_REQUEST);
        }

        console.log(`[ingestText] chatbotId: ${chatbotId}`);
        console.log(`[ingestText] userId: ${userId}`);

        const chunks = chunkText(text);
        console.log(`[ingestText] Number of chunks: ${chunks.length}`);

        const embeddingPromises: Promise<any>[] = [];
        let openaiQuotaExceeded = false;

        for (const chunk of chunks) {
            if (chunk.length === 0) continue;
            if (openaiQuotaExceeded) break;

            embeddingPromises.push(
                (async () => {
                    try {
                        const embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-3-small",
                            input: chunk,
                        });
                        const embedding = embeddingResponse.data[0].embedding;

                        const { error: insertError } = await supabase
                            .from('document_chunks')
                            .insert({
                                content: String(chunk), // Always string
                                embedding: embedding, // Always array of floats
                                chatbot_id: chatbotId,
                                user_id: validUserId,
                                source_url: req.body.source_url || null,
                                title: req.body.title || null,
                                links: req.body.links ? JSON.stringify(req.body.links) : null,
                                buttons: req.body.buttons ? JSON.stringify(req.body.buttons) : null,
                            });

                        if (insertError) {
                            console.error('Supabase insert error: ' + insertError.message, insertError);
                        }
                    } catch (embedOrInsertError: any) {
                        if (
                            embedOrInsertError.status === 429 ||
                            (embedOrInsertError.message && embedOrInsertError.message.includes("quota"))
                        ) {
                            if (!openaiQuotaExceeded) {
                                logger.error(
                                    "OpenAI quota exceeded. Halting further embedding requests until resolved."
                                );
                            }
                            openaiQuotaExceeded = true;
                        } else {
                            logger.error(
                                'Error during embedding generation or insertion: ' +
                                (embedOrInsertError.message || embedOrInsertError)
                            );
                        }
                    }
                })()
            );
        }

        await Promise.all(embeddingPromises);

        if (openaiQuotaExceeded) {
            return ServiceResponse.failure(
                "OpenAI quota exceeded. Please check your plan and billing details.",
                null,
                StatusCodes.TOO_MANY_REQUESTS
            );
        }

        return ServiceResponse.success(`Text ingested and processed for chatbot ${chatbotId}.`, null);
    } catch (err: any) {
        logger.error('Unhandled error during text ingestion: ' + err.message);
        return ServiceResponse.failure('Failed to process text.', null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotIngestService = {
    ingestText,
};
import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { chunkText } from "@/utils/chunkText";
import { supabase, logger, openai } from "@/server";

export async function ingestText(req: Request): Promise<ServiceResponse<null>> {
    try {
        const { text, chatbotId, userId } = req.body;

        if (!text || !chatbotId || !userId) {
            return ServiceResponse.failure("Missing text or chatbot id in request body.", null, StatusCodes.BAD_REQUEST);
        }

        // Log the chatbotId to ensure it's being passed correctly
        console.log(`[ingestText] chatbotId: ${chatbotId}`);

        const chunks = chunkText(text);

        // Log the length of the chunks array
        console.log(`[ingestText] Number of chunks: ${chunks.length}`);

        const embeddingPromises: Promise<any>[] = [];
        let openaiQuotaExceeded = false;

        for (const [idx, chunk] of chunks.entries()) {
            if (chunk.length === 0) continue;
            if (openaiQuotaExceeded) {
                break;
            }

            embeddingPromises.push(
                (async () => {
                    try {
                        const embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-3-small",
                            input: chunk,
                        });
                        const embedding = embeddingResponse.data[0].embedding;

                        // Ensure userId is a number (bigint)
                        const numericUserId = typeof userId === 'number' ? userId : null; // Or handle the default case differently

                        const { data: insertData, error: insertError } = await supabase
                            .from('document_chunks')
                            .insert({
                                content: chunk,
                                embedding: embedding,
                                chatbot_id: Number(chatbotId),
                                user_id: numericUserId,
                            })
                            .select();

                        if (insertError) {
                            console.error('Supabase insert error: ' + insertError.message, insertError);
                            console.error('Supabase insert error details:', insertError); // Log the full error object
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
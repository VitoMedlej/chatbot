import { Request } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { chunkText } from "@/utils/chunkText";
import { supabase, logger, openai } from "@/server";

async function ingestText(req: Request): Promise<ServiceResponse<null>> {
    try {
        const { text, chatbotId } = req.body;
        if (!text || !chatbotId) {
            return ServiceResponse.failure("Missing text or chatbotId in request body.", null, StatusCodes.BAD_REQUEST);
        }

        const chunks = chunkText(text);

        const { error: deleteError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('chatbot_id', chatbotId);

        if (deleteError) {
            logger.error('Supabase delete error (ingest-text): ' + deleteError.message);
        }

        const embeddingPromises: Promise<any>[] = [];

        for (const chunk of chunks) {
            if (chunk.length === 0) continue;

            embeddingPromises.push(
                (async () => {
                    try {
                        // Correct usage for OpenAI v4 SDK
                        const embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-ada-002",
                            input: chunk,
                        });
                        const embedding = embeddingResponse.data[0].embedding;

                        const { error: insertError } = await supabase
                            .from('document_chunks')
                            .insert({
                                content: chunk,
                                embedding: embedding,
                                chatbot_id: chatbotId,
                            });

                        if (insertError) {
                            logger.error('Supabase insert error (ingest-text): ' + insertError.message);
                        }
                    } catch (embedOrInsertError: any) {
                        logger.error('Error during embedding generation or insertion: ' + embedOrInsertError.message);
                    }
                })()
            );
        }

        await Promise.all(embeddingPromises);

        return ServiceResponse.success(`Text ingested and processed for chatbot ${chatbotId}.`, null);
    } catch (err: any) {
        logger.error('Unhandled error during text ingestion: ' + err.message);
        return ServiceResponse.failure('Failed to process text.', null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

export const chatbotIngestService = {
    ingestText,
};
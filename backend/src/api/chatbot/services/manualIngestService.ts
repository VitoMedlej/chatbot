import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { openai, supabase } from "@/server";
import { chunkText } from "@/utils/chunkText";

export async function ingestManualText(req: any): Promise<ServiceResponse<any>> {
    try {
        const { chatbotId, title, description, content } = req.body;
        if (!chatbotId || !content) {
            return ServiceResponse.failure("Missing chatbotId or content.", null, StatusCodes.BAD_REQUEST);
        }

        // Chunk the content
        const chunks = chunkText(content);

        // Generate embeddings for each chunk
        const embeddings = await Promise.all(
            chunks.map(async (chunk) => {
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: chunk,
                });
                return embeddingResponse.data[0].embedding;
            })
        );

        // Insert chunks into document_chunks table
        const { error } = await supabase.from("document_chunks").insert(
            chunks.map((chunk, index) => ({
                chatbot_id: chatbotId,
                content: chunk,
                embedding: embeddings[index],
                title,
                description,
            }))
        );

        if (error) {
            return ServiceResponse.failure("Failed to save chunks.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return ServiceResponse.success("Manual text ingested successfully.", null);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to ingest manual text.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
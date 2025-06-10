import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { openai, supabase } from "@/server";
import { chunkText } from "@/utils/chunkText";

export async function ingestManualText(req: any): Promise<ServiceResponse<any>> {
    try {
        const { chatbotId, userId, title, description, content } = req.body;
        if (!chatbotId || !content || !userId) {
            return ServiceResponse.failure("Missing chatbotId, userId, or content.", null, StatusCodes.BAD_REQUEST);
        }

        // Deduplicate: check if content already exists for this chatbot and title/description/content
        const { data: existing, error: existingError } = await supabase
            .from("chatbot_knowledge")
            .select("id")
            .eq("chatbot_id", chatbotId)
            .eq("title", title)
            .eq("description", description)
            .eq("content", content);
        if (existingError) {
            return ServiceResponse.failure("Failed to check for duplicates.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        if (existing && existing.length > 0) {
            return ServiceResponse.success("Duplicate content detected. Skipping ingestion.", null);
        }

        // Insert into chatbot_knowledge first
        const { data: inserted, error: knowledgeError } = await supabase.from("chatbot_knowledge").insert([
            {
                chatbot_id: chatbotId,
                user_id: userId,
                source_type: "manual",
                source_name: title || "Manual Entry",
                title,
                description,
                content,
                links: null,
                buttons: null,
                metadata: null
            }
        ]).select();
        if (knowledgeError) {
            return ServiceResponse.failure("Failed to save knowledge.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Chunk the content
        const chunks = chunkText(content);

        // Generate embeddings for each chunk
        let embeddings: any[] = [];
        try {
            embeddings = await Promise.all(
                chunks.map(async (chunk) => {
                    const embeddingResponse = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: chunk,
                    });
                    return embeddingResponse.data[0].embedding;
                })
            );
        } catch (embedErr: any) {
            // Rollback: delete the just-inserted chatbot_knowledge row
            if (inserted && inserted[0] && inserted[0].id) {
                await supabase.from("chatbot_knowledge").delete().eq("id", inserted[0].id);
            }
            return ServiceResponse.failure("Failed to generate embeddings. Rolled back knowledge base entry.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Insert chunks into document_chunks table
        const { error } = await supabase.from("document_chunks").insert(
            chunks.map((chunk, index) => ({
                chatbot_id: chatbotId,
                user_id: userId,
                content: chunk,
                embedding: embeddings[index],
                title,
                description,
            }))
        );

        if (error) {
            // Rollback: delete the just-inserted chatbot_knowledge row
            if (inserted && inserted[0] && inserted[0].id) {
                await supabase.from("chatbot_knowledge").delete().eq("id", inserted[0].id);
            }
            return ServiceResponse.failure("Failed to save chunks. Rolled back knowledge base entry.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Do NOT update setup_complete here (manual ingest)
        return ServiceResponse.success("Manual text ingested successfully.", null);
    } catch (err: any) {
        return ServiceResponse.failure("Failed to ingest manual text.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
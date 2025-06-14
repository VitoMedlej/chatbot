import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { openai, supabase } from "@/server";
import { chunkText } from "@/utils/chunkText";

export async function ingestManualText(req: any): Promise<ServiceResponse<any>> {
    const startTime = Date.now();
    let timings: { [key: string]: number } = {};
    
    try {
        const { chatbotId, userId, title, description, content } = req.body;
        if (!chatbotId || !content || !userId) {
            return ServiceResponse.failure("Missing chatbotId, userId, or content.", null, StatusCodes.BAD_REQUEST);
        }

        // Performance tracking: Duplicate check
        const duplicateCheckStart = Date.now();
        const { data: existing, error: existingError } = await supabase
            .from("chatbot_knowledge")
            .select("id")
            .eq("chatbot_id", chatbotId)
            .eq("title", title)
            .eq("description", description)
            .eq("content", content);
        timings.duplicateCheck = Date.now() - duplicateCheckStart;
        
        if (existingError) {
            return ServiceResponse.failure("Failed to check for duplicates.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        if (existing && existing.length > 0) {
            return ServiceResponse.success("Duplicate content detected. Skipping ingestion.", null);
        }

        // Performance tracking: Knowledge base insertion
        const knowledgeInsertStart = Date.now();
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
        timings.knowledgeInsert = Date.now() - knowledgeInsertStart;
        
        if (knowledgeError) {
            return ServiceResponse.failure("Failed to save knowledge.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Performance tracking: Text chunking
        const chunkingStart = Date.now();
        const chunks = chunkText(content);
        timings.chunking = Date.now() - chunkingStart;        // Performance tracking: Embedding generation (sequential to avoid rate limits)
        const embeddingStart = Date.now();
        let embeddings: any[] = [];
        try {
            for (const chunk of chunks) {
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunk,
                });
                embeddings.push(embeddingResponse.data[0].embedding);
            }
        } catch (embedErr: any) {
            // Rollback: delete the just-inserted chatbot_knowledge row
            if (inserted && inserted[0] && inserted[0].id) {
                await supabase.from("chatbot_knowledge").delete().eq("id", inserted[0].id);
            }
            return ServiceResponse.failure("Failed to generate embeddings. Rolled back knowledge base entry.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        timings.embeddings = Date.now() - embeddingStart;

        // Performance tracking: Chunk storage
        const chunkStorageStart = Date.now();
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
        timings.chunkStorage = Date.now() - chunkStorageStart;        if (error) {
            // Rollback: delete the just-inserted chatbot_knowledge row
            if (inserted && inserted[0] && inserted[0].id) {
                await supabase.from("chatbot_knowledge").delete().eq("id", inserted[0].id);
            }
            return ServiceResponse.failure("Failed to save chunks. Rolled back knowledge base entry.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Calculate total time and log performance metrics
        const totalTime = Date.now() - startTime;
        timings.total = totalTime;
        
        console.log(`[PERFORMANCE] Manual text ingestion completed in ${totalTime}ms:`, {
            duplicateCheck: `${timings.duplicateCheck}ms`,
            knowledgeInsert: `${timings.knowledgeInsert}ms`,
            chunking: `${timings.chunking}ms`,
            embeddings: `${timings.embeddings}ms`,
            chunkStorage: `${timings.chunkStorage}ms`,
            chatbotId,
            contentLength: content.length,
            chunksGenerated: chunks.length,
            embeddingsGenerated: embeddings.length
        });

        // Do NOT update setup_complete here (manual ingest)
        return ServiceResponse.success("Manual text ingested successfully.", null);
    } catch (err: any) {
        const totalTime = Date.now() - startTime;
        console.error(`[PERFORMANCE ERROR] Manual text ingestion failed after ${totalTime}ms:`, {
            error: err.message,
            timings,
            chatbotId: req.body?.chatbotId,
            contentLength: req.body?.content?.length || 0
        });
        return ServiceResponse.failure("Failed to ingest manual text.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
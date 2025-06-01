import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

export async function chatWithContext(req: any): Promise<ServiceResponse<null | string>> {
    try {
        const { userId, chatbotId, message } = req.body;
        if (!userId || !chatbotId || !message) {
            return ServiceResponse.failure("Missing userId, chatbotId, or message.", null, StatusCodes.BAD_REQUEST);
        }

        // Save user message
        await supabase.from("chat_history").insert({
            user_id: userId,
            chatbot_id: chatbotId,
            message,
            sender: "user",
        });

        // Fetch recent chat history (last 10)
        const { data: history, error: historyError } = await supabase
            .from("chat_history")
            .select("message,sender")
            .eq("user_id", userId)
            .eq("chatbot_id", chatbotId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (historyError) {
            return ServiceResponse.failure("Failed to fetch chat history.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // --- VECTOR SEARCH: retrieve relevant chunks ---
        // Get embedding for the current message
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: message,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Query vector DB for top 3 relevant chunks
        const { data: chunks, error: chunkError } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 3,
            chatbot_id: chatbotId,
        });

        if (chunkError) {
            return ServiceResponse.failure("Failed to retrieve knowledge base context.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // --- Build prompt ---
        let prompt = "";
        // Add chat history
        (history || []).reverse().forEach((entry: any) => {
            prompt += `${entry.sender === "user" ? "User" : "Bot"}: ${entry.message}\n`;
        });
        // Add knowledge context
        if (chunks && chunks.length > 0) {
            prompt += "\nKnowledge Base Context:\n";
            chunks.forEach((chunk: any, idx: number) => {
                prompt += `Context ${idx + 1}: ${chunk.content}\n`;
            });
        }
        prompt += "Bot:";

        // --- Call OpenAI ---
        const llmResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a helpful assistant. Use the provided context if relevant." },
                { role: "user", content: prompt }
            ]
        });
        const botReply = llmResponse.choices[0].message.content;

        // Save bot reply
        await supabase.from("chat_history").insert({
            user_id: userId,
            chatbot_id: chatbotId,
            message: botReply,
            sender: "bot",
        });

        return ServiceResponse.success("Bot reply generated.", botReply);
    } catch (err: any) {
        return ServiceResponse.failure("Internal server error.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
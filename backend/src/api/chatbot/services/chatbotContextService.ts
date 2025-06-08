import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

export async function chatWithContext(req: any): Promise<ServiceResponse<null | string>> {
    console.log("chatWithContext called", JSON.stringify(req.body));
    try {
        let { userId, chatbotId, message } = req.body;
        console.log('chatbotId: ', chatbotId);
        chatbotId = Number(chatbotId); // Ensure chatbotId is a number


        // Validate chatbotId as a UUID
        if (!chatbotId) {
            return ServiceResponse.failure("Invalid chatbotId. Must be a valid UUID.", null, 400);
        }

        if (!userId || !message) {
            return ServiceResponse.failure("Missing required fields.", null, 400);
        }

        // Ensure chatbotId is a number
        const numericChatbotId = Number(chatbotId);
        if (isNaN(numericChatbotId)) {
            return ServiceResponse.failure("Invalid chatbotId. Must be a valid number.", null, 400);
        }

        // Save user message
        const { error: insertUserMsgError } = await supabase.from("chat_history").insert({
            user_id: userId,
            chatbot_id: numericChatbotId,
            message,
            sender: "user",
        });
        if (insertUserMsgError) {
            console.error("Error inserting user message:", insertUserMsgError);
            return ServiceResponse.failure("Failed to save user message.", null, 500);
        }

        // Fetch recent chat history (last 10)
        const { data: history, error: fetchHistoryError } = await supabase
            .from("chat_history")
            .select("message,sender")
            .eq("user_id", userId)
            .eq("chatbot_id", numericChatbotId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (fetchHistoryError) {
            console.error("Error fetching chat history:", fetchHistoryError);
            return ServiceResponse.failure("Failed to retrieve chat history.", null, 500);
        }

        // VECTOR SEARCH: retrieve relevant chunks
        let embedding;
        try {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: message,
            });
            embedding = embeddingResponse.data[0].embedding;
        } catch (embedErr: any) {
            console.error("OpenAI embedding error", embedErr);
            return ServiceResponse.failure("Failed to generate embedding.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        console.log("Embedding generated:", embedding);
        console.log("Casting chatbotId to UUID for document_chunks table:", numericChatbotId);

        const { data: chunks, error: chunkError } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 3,
            chatbot_id: numericChatbotId.toString(), // Cast to UUID
        });

        if (chunkError) {
            console.error("Failed to retrieve knowledge base context", chunkError);
            return ServiceResponse.failure("Failed to retrieve knowledge base context.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        console.log("Chunks retrieved:", chunks);

        // Check if chunks are empty and provide a fallback response
        if (!chunks || chunks.length === 0) {
            console.warn("No knowledge base data available. Providing fallback response.");
            const fallbackResponse = "I'm sorry, I currently don't have enough information to answer that. Please try asking something else or contact support.";

            // Save fallback bot reply
            const { error: insertFallbackMsgError } = await supabase.from("chat_history").insert({
                user_id: userId,
                chatbot_id: numericChatbotId,
                message: fallbackResponse,
                sender: "bot",
            });
            if (insertFallbackMsgError) {
                console.error("Failed to insert fallback bot reply", insertFallbackMsgError);
                return ServiceResponse.failure("Failed to save fallback bot reply.", null, StatusCodes.INTERNAL_SERVER_ERROR);
            }

            return ServiceResponse.success("Fallback bot reply generated.", fallbackResponse);
        }

        // Fetch chatbot persona/instructions
        const { data: chatbotInfo, error: chatbotInfoError } = await supabase
            .from("chatbots")
            .select("business_name,persona,instructions")
            .eq("id", numericChatbotId)
            .single();

        if (chatbotInfoError) {
            console.error("Failed to fetch chatbot info", chatbotInfoError);
            return ServiceResponse.failure("Failed to fetch chatbot info.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        const systemPrompt =
            chatbotInfo?.instructions ||
            chatbotInfo?.persona ||
            `You are the official chatbot for ${chatbotInfo?.business_name || "this business"}. Be concise unless asked for details. Never say you are ChatGPT. Always answer as a representative of ${chatbotInfo?.business_name || "this business"}.`;

        // Build chat history string
        let chatHistory = "";
        (history || []).reverse().forEach((entry: any) => {
            chatHistory += `${entry.sender === "user" ? "User" : "Bot"}: ${entry.message}\n`;
        });

        // Build knowledge context string
        let knowledgeContext = "";
        if (chunks && chunks.length > 0) {
            knowledgeContext += "\nKnowledge Base Context:\n";
            chunks.forEach((chunk: any, idx: number) => {
                let meta = "";
                if (chunk.title) meta += `Title: ${chunk.title}\n`;
                if (chunk.source_url) meta += `URL: ${chunk.source_url}\n`;
                if (chunk.links && chunk.links.length) meta += `Links: ${JSON.stringify(chunk.links)}\n`;
                if (chunk.buttons && chunk.buttons.length) meta += `Buttons: ${JSON.stringify(chunk.buttons)}\n`;
                knowledgeContext += `Context ${idx + 1}:\n${meta}Content: ${chunk.content}\n`;
            });
        }

        // Compose user prompt
        const userPrompt = `${chatHistory}\n${knowledgeContext}\nBot:`;

        // Call OpenAI
        let botReply = "";
        try {
            const llmResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 512,
                temperature: 0.2,
            });
            botReply = llmResponse.choices[0].message.content ?? "";
        } catch (llmErr: any) {
            console.error("OpenAI chat completion error", llmErr);
            return ServiceResponse.failure("Failed to generate bot reply.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Save bot reply
        const { error: insertBotMsgError } = await supabase.from("chat_history").insert({
            user_id: userId,
            chatbot_id: chatbotId,
            message: botReply,
            sender: "bot",
        });
        if (insertBotMsgError) {
            console.error("Failed to insert bot reply", insertBotMsgError);
            return ServiceResponse.failure("Failed to save bot reply.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        console.log("Bot reply generated successfully");
        return ServiceResponse.success("Bot reply generated.", botReply);
    } catch (err: any) {
        console.error("Unhandled error in chatWithContext", err);
        return ServiceResponse.failure("Internal server error.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

export async function chatWithContext(req: any): Promise<ServiceResponse<null | string>> {
    console.log("chatWithContext called", JSON.stringify(req.body));
    try {
        const { userId, chatbotId, message } = req.body;
        if (!userId || !chatbotId || !message) {
            console.error("Missing userId, chatbotId, or message", { userId, chatbotId, message });
            return ServiceResponse.failure("Missing userId, chatbotId, or message.", null, StatusCodes.BAD_REQUEST);
        }

        // Save user message
        const { error: insertUserMsgError } = await supabase.from("chat_history").insert({
            user_id: userId,
            chatbot_id: chatbotId,
            message,
            sender: "user",
        });
        if (insertUserMsgError) {
            console.error("Failed to insert user message", insertUserMsgError);
            return ServiceResponse.failure("Failed to save user message.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Fetch recent chat history (last 10)
        const { data: history, error: historyError } = await supabase
            .from("chat_history")
            .select("message,sender")
            .eq("user_id", userId)
            .eq("chatbot_id", chatbotId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (historyError) {
            console.error("Failed to fetch chat history", historyError);
            return ServiceResponse.failure("Failed to fetch chat history.", null, StatusCodes.INTERNAL_SERVER_ERROR);
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

        const { data: chunks, error: chunkError } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 3,
            chatbot_id: chatbotId,
        });

        if (chunkError) {
            console.error("Failed to retrieve knowledge base context", chunkError);
            return ServiceResponse.failure("Failed to retrieve knowledge base context.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Fetch chatbot persona/instructions
        const { data: chatbotInfo, error: chatbotInfoError } = await supabase
            .from("chatbots")
            .select("business_name,persona,instructions")
            .eq("id", chatbotId)
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
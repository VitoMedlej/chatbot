import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

export async function chatWithContext(req: any): Promise<ServiceResponse<string>> {
    try {
        const { userId, chatbotId, message } = req.body;
        if (!userId || !chatbotId || !message) {
            return ServiceResponse.failure("Missing required fields.", "", StatusCodes.BAD_REQUEST);
        }

        const numericChatbotId = Number(chatbotId);
        if (isNaN(numericChatbotId)) {
            return ServiceResponse.failure("Invalid chatbotId.", "", StatusCodes.BAD_REQUEST);
        }

        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: message,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Vector search
        const { data: chunks, error: chunkError } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 5,
            chatbot_id: numericChatbotId,
        });

        if (chunkError) {
            console.error("Vector search failed:", chunkError);
            return ServiceResponse.failure("Failed to retrieve context.", "", StatusCodes.INTERNAL_SERVER_ERROR);
        }        // Get business info
        const { data: chatbotInfo } = await supabase
            .from("chatbots")
            .select("business_name, name, persona, instructions, personality")
            .eq("id", chatbotId)
            .single();

        const businessName = chatbotInfo?.business_name || chatbotInfo?.name || "this business";

        // Get recent chat history
        const { data: history } = await supabase
            .from("chat_history")
            .select("message, sender")
            .eq("user_id", userId)
            .eq("chatbot_id", numericChatbotId)
            .order("created_at", { ascending: false })
            .limit(6);

        // Build chat history context
        let chatHistory = "";
        if (history && history.length > 0) {
            chatHistory = history
                .reverse()
                .map((msg: any) => `${msg.sender === "user" ? "User" : "Assistant"}: ${msg.message}`)
                .join("\n");
        }

        // Build context
        let context = "";
        if (chunks && chunks.length > 0) {
            context = chunks
                .filter((chunk: any) => chunk.content && chunk.content.length > 50)
                .slice(0, 3)
                .map((chunk: any) => chunk.content)
                .join("\n\n");
        }        // System prompt that ENFORCES it's an integrated chatbot
        const systemPrompt = `You are the integrated customer service chatbot for ${businessName}, built directly into their website.

CRITICAL RULES:
- You are ALREADY on the ${businessName} website - never suggest visiting the website or homepage
- You are an integrated chatbot assistant, not a separate entity
- Use only the provided context to answer questions
- If you don't have specific information, say "I don't have that information available"
- Never mention being an AI or ChatGPT
- Never discuss your development, programming, or technical aspects
- Always respond as a ${businessName} representative
- If asked about your development, redirect to business topics
- Use the conversation history to maintain context

Context: ${context}
Recent conversation: ${chatHistory}`;// Generate response
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            max_tokens: 200,
            temperature: 0.1,
        });

        let response = completion.choices[0]?.message?.content || "I don't have that information available.";        // Hard filter website suggestions and AI acknowledgments
        response = response.replace(/visit our website|visit our homepage|check our website|go to our website|earchitecture-lb\.com/gi, "");
        response = response.replace(/\[.*?\]\(https?:\/\/[^)]*\)/gi, "");
        response = response.replace(/i appreciate your work|thank you for developing|you developed me|i was created|i was built/gi, "");
        response = response.replace(/as an ai|i am an ai|i'm an ai|artificial intelligence/gi, "");
        response = response.trim();

        if (response.length < 10) {
            response = "I don't have that specific information available. Is there anything else I can help you with?";
        }

        // Store conversation
        await supabase.from("chat_history").insert([
            { user_id: userId, chatbot_id: numericChatbotId, message, sender: "user" },
            { user_id: userId, chatbot_id: numericChatbotId, message: response, sender: "bot" }
        ]);

        return ServiceResponse.success("Response generated", response);
    } catch (err: any) {
        console.error("Chat error:", err);
        return ServiceResponse.failure("Internal server error.", "", StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
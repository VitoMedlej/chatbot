import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

export async function chatWithContext(req: any): Promise<ServiceResponse<string>> {
    const startTime = Date.now();
    let timings: { [key: string]: number } = {};
    
    try {
        const { userId, chatbotId, message } = req.body;
        if (!userId || !chatbotId || !message) {
            return ServiceResponse.failure("Missing required fields.", "", StatusCodes.BAD_REQUEST);
        }

        const numericChatbotId = Number(chatbotId);
        if (isNaN(numericChatbotId)) {
            return ServiceResponse.failure("Invalid chatbotId.", "", StatusCodes.BAD_REQUEST);
        }

        // Performance tracking: Embedding generation
        const embeddingStart = Date.now();
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: message,
        });
        const embedding = embeddingResponse.data[0].embedding;
        timings.embedding = Date.now() - embeddingStart;        // Performance tracking: Vector search
        const vectorSearchStart = Date.now();
        const { data: chunks, error: chunkError } = await supabase.rpc("match_document_chunks", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 5,
            chatbot_id: numericChatbotId,
        });
        timings.vectorSearch = Date.now() - vectorSearchStart;

        if (chunkError) {
            console.error("Vector search failed:", chunkError);
            return ServiceResponse.failure("Failed to retrieve context.", "", StatusCodes.INTERNAL_SERVER_ERROR);
        }
        
        // Performance tracking: Database queries
        const dbStart = Date.now();        // Get business info
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
        
        timings.databaseQueries = Date.now() - dbStart;        // Performance tracking: Context processing
        const contextStart = Date.now();
        
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
        }
        
        timings.contextProcessing = Date.now() - contextStart;        // System prompt that ENFORCES it's an integrated chatbot
        const systemPrompt = `You are the integrated customer service chatbot for ${businessName}, built directly into their website.

CRITICAL RULES:
- You are ALREADY on the ${businessName} website - never suggest visiting the website or homepage
- You are an integrated chatbot assistant, not a separate entity
- ONLY use the provided context to answer questions - never make assumptions
- If you don't have specific information in the context, say "I don't have that specific information available. Please contact our support team for details about [topic]"
- Never mention being an AI or ChatGPT
- Never discuss your development, programming, or technical aspects
- Always respond as a ${businessName} representative
- If asked about your development, redirect to business topics
- Use the conversation history to maintain context
- For technical issues (checkout, payments, account problems), always direct users to contact support rather than guessing solutions

IMPORTANT: If someone asks about payment methods, checkout process, shipping, returns, or any operational details not in your context, respond with: "I don't have the current details about our [payment methods/checkout process/shipping/etc.]. Please contact our support team who can provide you with the most up-to-date information and help resolve any issues."

Context: ${context}
Recent conversation: ${chatHistory}`;

        // Performance tracking: OpenAI chat completion
        const chatCompletionStart = Date.now();
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            max_tokens: 200,
            temperature: 0.1,
        });
        timings.chatCompletion = Date.now() - chatCompletionStart;        let response = completion.choices[0]?.message?.content || "I don't have that information available.";
        
        // Performance tracking: Response processing
        const responseProcessingStart = Date.now();

        // Hard filter website suggestions and AI acknowledgments
        response = response.replace(/visit our website|visit our homepage|check our website|go to our website|earchitecture-lb\.com/gi, "");
        response = response.replace(/\[.*?\]\(https?:\/\/[^)]*\)/gi, "");
        response = response.replace(/i appreciate your work|thank you for developing|you developed me|i was created|i was built/gi, "");
        response = response.replace(/as an ai|i am an ai|i'm an ai|artificial intelligence/gi, "");
        
        // Detect if the response contains technical advice without proper context
        const technicalKeywords = /checkout|payment|card|billing|shipping|account|login|password|technical issue|cache|cookies|refresh/gi;
        const hasContext = context && context.length > 100;
        
        // If giving technical advice without context, redirect to support
        if (technicalKeywords.test(response) && !hasContext) {
            response = "I don't have the current details about our payment and checkout process. Please contact our support team who can provide you with the most up-to-date information and help resolve any technical issues you're experiencing.";
        }
        
        response = response.trim();

        if (response.length < 10) {
            response = "I don't have that specific information available. Please contact our support team for assistance.";
        }
        
        timings.responseProcessing = Date.now() - responseProcessingStart;

        // Performance tracking: Database storage
        const storageStart = Date.now();
        await supabase.from("chat_history").insert([
            { user_id: userId, chatbot_id: numericChatbotId, message, sender: "user" },
            { user_id: userId, chatbot_id: numericChatbotId, message: response, sender: "bot" }
        ]);
        timings.storage = Date.now() - storageStart;

        // Calculate total time and log performance metrics
        const totalTime = Date.now() - startTime;
        timings.total = totalTime;
        
        console.log(`[PERFORMANCE] Chat request completed in ${totalTime}ms:`, {
            embedding: `${timings.embedding}ms`,
            vectorSearch: `${timings.vectorSearch}ms`, 
            databaseQueries: `${timings.databaseQueries}ms`,
            contextProcessing: `${timings.contextProcessing}ms`,
            chatCompletion: `${timings.chatCompletion}ms`,
            responseProcessing: `${timings.responseProcessing}ms`,
            storage: `${timings.storage}ms`,
            chatbotId: numericChatbotId,
            messageLength: message.length,
            responseLength: response.length,
            contextChunks: chunks?.length || 0
        });        return ServiceResponse.success("Response generated", response);
    } catch (err: any) {
        const totalTime = Date.now() - startTime;
        console.error(`[PERFORMANCE ERROR] Chat request failed after ${totalTime}ms:`, {
            error: err.message,
            timings,
            chatbotId: req.body?.chatbotId,
            messageLength: req.body?.message?.length || 0
        });
        return ServiceResponse.failure("Internal server error.", "", StatusCodes.INTERNAL_SERVER_ERROR);
    }
}
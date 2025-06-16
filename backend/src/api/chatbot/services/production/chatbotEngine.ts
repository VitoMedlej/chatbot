import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";
import { PromptSecurityService } from "@/services/promptSecurityService";
import { SecurePromptBuilder } from "@/services/securePromptBuilder";

interface ChatRequest {
  userId: string;
  chatbotId: string;
  message: string;
  sessionId?: string;
}

interface ChatContext {
  chunks: DocumentChunk[];
  businessInfo: BusinessInfo;
  conversation: ConversationHistory;
}

interface DocumentChunk {
  id: string;
  content: string;
  similarity: number;
  source: string;
  metadata: any;
}

interface BusinessInfo {
  name: string;
  industry: string;
  persona: string;
  tone: string;
  guidelines: string[];
  restrictions: string[];
}

interface ConversationHistory {
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  context: string[];
}

export class ProductionChatbotEngine {
  private static readonly CONFIG = {
    SIMILARITY_THRESHOLD: 0.82,
    MAX_CONTEXT_CHUNKS: 5,
    MAX_CONVERSATION_HISTORY: 8,
    RESPONSE_MAX_TOKENS: 200,
    TEMPERATURE: 0.1,
    MODEL: "gpt-3.5-turbo",
    CONTEXT_WINDOW: 6000,
    MIN_CHUNK_LENGTH: 100,
    MAX_CHUNK_LENGTH: 1000
  };
  async processChat(request: ChatRequest): Promise<ServiceResponse<string>> {    try {
      // 1. SECURITY: Validate input for prompt injection
      const securityValidation = await PromptSecurityService.validateUserInput(
        request.message, 
        request.sessionId || request.userId
      );
      
      if (!securityValidation.success) {
        // Log security incident
        console.warn('[SECURITY BLOCK]', {
          userId: request.userId,
          chatbotId: request.chatbotId,
          message: request.message.substring(0, 100),
          reason: securityValidation.message,
          timestamp: new Date().toISOString()
        });
        
        return securityValidation;
      }

      // Use sanitized message
      const sanitizedMessage = securityValidation.responseObject!;

      // 2. Validate request structure
      const validation = this.validateRequest({ ...request, message: sanitizedMessage });
      if (!validation.isValid) {
        return ServiceResponse.failure(validation.error!, "", StatusCodes.BAD_REQUEST);
      }

      // 3. Build context with sanitized input
      const context = await this.buildContext({ ...request, message: sanitizedMessage });
      if (!context) {
        return ServiceResponse.failure("Failed to build context", "", StatusCodes.INTERNAL_SERVER_ERROR);
      }      // 4. Generate response with security measures
      const response = await this.generateResponse({ ...request, message: sanitizedMessage }, context);
      if (!response) {
        return this.getFallbackResponse();
      }

      // 5. Validate response for security
      const responseValidation = SecurePromptBuilder.validateResponse(response);
      if (!responseValidation.isValid) {
        console.warn('[SECURITY] Compromised response detected:', {
          reason: responseValidation.reason,
          response: response.substring(0, 100),
          chatbotId: request.chatbotId,
          timestamp: new Date().toISOString()
        });
        
        return this.getFallbackResponse();
      }

      // 6. Final sanitization and storage
      const finalResponse = this.validateAndSanitizeResponse(response, context.businessInfo);
      if (!finalResponse) {
        return this.getFallbackResponse();
      }      // 7. Store conversation with sanitized data
      await this.storeConversation({ ...request, message: sanitizedMessage }, finalResponse);

      return ServiceResponse.success("Response generated", finalResponse);
    } catch (error: any) {
      console.error("[ChatbotEngine] Error:", error);
      return ServiceResponse.failure("Internal error", "", StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  private validateRequest(request: ChatRequest): { isValid: boolean; error?: string } {
    if (!request.userId || !request.chatbotId || !request.message) {
      return { isValid: false, error: "Missing required fields" };
    }
    if (request.message.length > 1000) {
      return { isValid: false, error: "Message too long" };
    }
    if (request.message.trim().length < 2) {
      return { isValid: false, error: "Message too short" };
    }
    return { isValid: true };
  }

  private async buildContext(request: ChatRequest): Promise<ChatContext | null> {
    try {
      // Get business info
      const businessInfo = await this.getBusinessInfo(request.chatbotId);
      if (!businessInfo) return null;

      // Get relevant chunks
      const chunks = await this.getRelevantChunks(request.message, request.chatbotId);

      // Get conversation history
      const conversation = await this.getConversationHistory(request.userId, request.chatbotId);

      return { chunks, businessInfo, conversation };
    } catch (error) {
      console.error("[ChatbotEngine] Context building failed:", error);
      return null;
    }
  }

  private async getBusinessInfo(chatbotId: string): Promise<BusinessInfo | null> {
    const { data, error } = await supabase
      .from("chatbots")
      .select("name, business_name, persona, personality, instructions")
      .eq("id", chatbotId)
      .single();

    if (error || !data) return null;

    return {
      name: data.business_name || data.name || "Business",
      industry: "General",
      persona: data.persona || data.instructions || "",
      tone: data.personality || "professional",
      guidelines: [
        "Always represent the business professionally",
        "Use only provided context information",
        "Never make up information not in context",
        "Stay focused on business-related queries"
      ],
      restrictions: [
        "Do not mention being an AI or chatbot",
        "Do not suggest visiting external websites",
        "Do not provide personal opinions",
        "Do not discuss competitors"
      ]
    };
  }

  private async getRelevantChunks(message: string, chatbotId: string): Promise<DocumentChunk[]> {
    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: message,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Vector search
    const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: embedding,
      match_threshold: ProductionChatbotEngine.CONFIG.SIMILARITY_THRESHOLD,
      match_count: ProductionChatbotEngine.CONFIG.MAX_CONTEXT_CHUNKS,
      chatbot_id: chatbotId,
    });

    if (error || !chunks) return [];    // Filter and process chunks
    return chunks
      .filter((chunk: any) => 
        chunk.content && 
        chunk.content.length >= ProductionChatbotEngine.CONFIG.MIN_CHUNK_LENGTH &&
        chunk.content.length <= ProductionChatbotEngine.CONFIG.MAX_CHUNK_LENGTH &&
        !this.isBoilerplateContent(chunk.content)
      )
      .map((chunk: any) => ({
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.similarity,
        source: chunk.source_url || "Internal",
        metadata: chunk.metadata || {}
      }))
      .slice(0, ProductionChatbotEngine.CONFIG.MAX_CONTEXT_CHUNKS);
  }

  private isBoilerplateContent(content: string): boolean {
    const boilerplatePatterns = [
      /privacy policy/i,
      /terms of service/i,
      /cookie policy/i,
      /copyright.*all rights reserved/i,
      /follow us on social media/i,
      /subscribe to our newsletter/i,
      /contact us for more info/i,
      /visit our website/i,
      /home.*about.*contact/i
    ];

    return boilerplatePatterns.some(pattern => pattern.test(content));
  }

  private async getConversationHistory(userId: string, chatbotId: string): Promise<ConversationHistory> {
    const { data: history } = await supabase
      .from("chat_history")
      .select("message, sender, created_at")
      .eq("user_id", userId)
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false })
      .limit(ProductionChatbotEngine.CONFIG.MAX_CONVERSATION_HISTORY);

    if (!history || history.length === 0) {
      return { messages: [], context: [] };
    }

    const messages = history.reverse().map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.message,
      timestamp: new Date(msg.created_at)
    }));

    return { messages, context: [] };
  }

  private async generateResponse(request: ChatRequest, context: ChatContext): Promise<string | null> {
    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context.businessInfo);
    
    // Build context string
    const contextString = context.chunks
      .map(chunk => `[Source: ${chunk.source}]\n${chunk.content}`)
      .join('\n\n---\n\n');    // Build conversation messages with secure user input wrapping
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(contextString ? [{ role: 'system' as const, content: `Context:\n${contextString}` }] : []),
      ...context.conversation.messages.slice(-6), // Last 6 messages for context
      { role: 'user' as const, content: SecurePromptBuilder.wrapUserMessage(request.message) }
    ];

    // Generate response
    const completion = await openai.chat.completions.create({
      model: ProductionChatbotEngine.CONFIG.MODEL,
      messages,
      max_tokens: ProductionChatbotEngine.CONFIG.RESPONSE_MAX_TOKENS,
      temperature: ProductionChatbotEngine.CONFIG.TEMPERATURE,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    return completion.choices[0]?.message?.content || null;
  }
  private buildSystemPrompt(businessInfo: BusinessInfo): string {
    // Use secure prompt builder instead of simple concatenation
    return SecurePromptBuilder.buildSecureSystemPrompt(businessInfo);
  }

  private validateAndSanitizeResponse(response: string, businessInfo: BusinessInfo): string | null {
    if (!response || response.trim().length < 10) return null;

    let sanitized = response.trim();

    // Remove problematic patterns
    const problematicPatterns = [
      /as an ai/gi,
      /i am an ai/gi,
      /as a chatbot/gi,
      /i'm a chatbot/gi,
      /visit our website/gi,
      /check our website/gi,
      /go to our homepage/gi,
      /click here/gi
    ];

    problematicPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Clean up formatting
    sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

    // Ensure minimum quality
    if (sanitized.length < 10 || sanitized === response.trim()) {
      return sanitized;
    }

    return sanitized.length > 0 ? sanitized : null;
  }

  private getFallbackResponse(): ServiceResponse<string> {
    const fallbacks = [
      "I don't have that information available right now. Is there something else I can help you with?",
      "I'm not able to answer that specific question. Can you try asking about something else?",
      "That's not something I have information about. What else can I assist you with today?"
    ];
    
    const response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return ServiceResponse.success("Fallback response", response);
  }

  private async storeConversation(request: ChatRequest, response: string): Promise<void> {
    // Store user message
    await supabase.from("chat_history").insert({
      user_id: request.userId,
      chatbot_id: request.chatbotId,
      message: request.message,
      sender: "user"
    });

    // Store bot response
    await supabase.from("chat_history").insert({
      user_id: request.userId,
      chatbot_id: request.chatbotId,
      message: response,
      sender: "bot"
    });
  }
}

export const productionChatbotEngine = new ProductionChatbotEngine();

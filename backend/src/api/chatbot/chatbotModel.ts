// filepath: c:\Users\Hp\Desktop\vitoz-code\chatbot\backend-express\src\api\chatbot\chatbotModel.ts
import { z } from "zod";

export type ChatbotRequest = z.infer<typeof ChatbotRequestSchema>;
export const ChatbotRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
});

export type ChatbotResponse = z.infer<typeof ChatbotResponseSchema>;
export const ChatbotResponseSchema = z.object({
  answer: z.string(),
});

export type ChatbotPersonality = "friendly" | "professional" | "enthusiastic" | "concise" | "empathetic";

export type Chatbot = {
  id: number;
  name: string;
  avatar_url?: string | null;
  logo_url?: string | null;
  personality: ChatbotPersonality;
  business_name: string;
  persona: string;
  instructions: string;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
};
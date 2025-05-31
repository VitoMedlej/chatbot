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
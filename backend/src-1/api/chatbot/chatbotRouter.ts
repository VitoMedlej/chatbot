import { z } from "zod";

export type ChatbotInteraction = z.infer<typeof ChatbotInteractionSchema>;

export const ChatbotInteractionSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().optional(),
});
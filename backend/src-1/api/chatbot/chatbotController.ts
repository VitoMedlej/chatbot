// filepath: c:\Users\Hp\Desktop\vitoz-code\chatbot\backend-express\src\api\chatbot\chatbotModel.ts
import { z } from "zod";

export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;
export const QuestionAnswerSchema = z.object({
  question: z.string().min(1, "Question is required"),
  userId: z.string().optional(), // Optional user ID if needed for tracking
});
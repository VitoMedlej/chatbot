import { supabase } from "@/server";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";

const GENERAL_QUESTIONS = [
    "What are your business hours?",
    "What services do you offer?",
    "How can I contact support?",
    "Where are you located?",
    "What is your refund policy?",
    "Do you have any ongoing promotions?"
];

export async function generateQuestions(chatbotId: string): Promise<ServiceResponse<string[]>> {
    try {
        if (!chatbotId) {
            return ServiceResponse.failure("Missing chatbotId.", [], StatusCodes.BAD_REQUEST);
        }

        // Fetch vector data for the chatbot
        const { data: chunks, error } = await supabase
            .from("document_chunks")
            .select("content")
            .eq("chatbot_id", chatbotId)
            .limit(6);

        if (error) {
            return ServiceResponse.failure("Failed to fetch vector data.", GENERAL_QUESTIONS, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        if (!chunks || chunks.length === 0) {
            // Return general questions if no vector data is available
            return ServiceResponse.success("General questions generated.", GENERAL_QUESTIONS);
        }

        // Generate user-friendly topics based on vector data
        const topics = chunks.map(chunk => {
            const contentPreview = chunk.content.replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 50).trim();
            return `${contentPreview} 💬`;
        });

        return ServiceResponse.success("Topics generated from vector data.", topics);
    } catch (err: any) {
        return ServiceResponse.failure(`Failed to generate questions: ${err.message}`, GENERAL_QUESTIONS, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

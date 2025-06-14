import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger, openai } from "@/server";
import { StatusCodes } from "http-status-codes";
import { Request } from "express";

export async function directQuestionAnswer(req: Request): Promise<ServiceResponse<{ answer: string } | null>> {
  try {
    const question = req.body?.question;
    if (!question || typeof question !== "string" || !question.trim()) {
      logger.error("No question provided");
      return ServiceResponse.failure("No question provided", null, StatusCodes.BAD_REQUEST);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", 
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: question }
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const answer = completion.choices?.[0]?.message?.content ?? "No answer generated.";
    return ServiceResponse.success("Answer generated", { answer });

  } catch (error) {
    logger.error(`Error in directQuestionAnswer: ${(error as Error).message}`);
    return ServiceResponse.failure(
      "An error occurred while generating an answer.",
      null,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

export const chatbotService = {
  directQuestionAnswer,
};
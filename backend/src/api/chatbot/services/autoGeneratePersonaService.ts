// Service to auto-generate or upsert a default persona for a chatbot

import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

/**
 * Upserts a default persona for a chatbot using a provided business name.
 */
export async function upsertDefaultPersona(chatbotId: string, businessName: string): Promise<ServiceResponse<any>> {
    if (!chatbotId || !businessName) {
        return ServiceResponse.failure("Missing chatbotId or businessName.", null, StatusCodes.BAD_REQUEST);
    }
    const personaObj = {
        business_name: businessName,
        persona: `You are the helpful assistant for ${businessName}.`,
        instructions: "Be concise and helpful. Never say you are ChatGPT. Always answer as a representative of the business. If you don't know, suggest contacting support."
    };
    const { error: upsertError } = await supabase.from("chatbots").upsert({
        id: chatbotId,
        business_name: personaObj.business_name,
        persona: personaObj.persona,
        instructions: personaObj.instructions
    });
    if (upsertError) {
        return ServiceResponse.failure("Failed to upsert default persona.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
    return ServiceResponse.success("Default persona upserted.", personaObj);
}

/**
 * Auto-generates a persona from website content, or falls back to default if no content.
 */
export async function autoGeneratePersona(req: any): Promise<ServiceResponse<any>> {
    const { chatbotId, businessName } = req.body;
    if (!chatbotId) {
        return ServiceResponse.failure("Missing chatbotId.", null, StatusCodes.BAD_REQUEST);
    }

    // Get the first 5 chunks for this chatbot (no source_url filter)
    const { data: chunks, error } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("chatbot_id", chatbotId)
        .limit(5);

    // If no content, upsert default persona using businessName or fallback
    if (error || !chunks || chunks.length === 0) {
        const fallbackName = businessName || "Your Business";
        return upsertDefaultPersona(chatbotId, fallbackName);
    }

    const combined = chunks.map(c => c.content).join("\n\n").slice(0, 1000);

    // Use OpenAI to generate business_name, persona, instructions
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are an expert at extracting business information from website text.`
            },
            {
                role: "user",
                content: `Given the following website content, extract:
- business_name: (short, e.g. "Acme Inc")
- persona: (one sentence, e.g. "You are the official chatbot for Acme Inc.")
- instructions: (one paragraph, e.g. "Be concise unless asked for details. Never say you are ChatGPT. Always answer as a representative of the business. If you don't know, suggest contacting support.")

Content:
${combined}

Respond in JSON:
{"business_name": "...", "persona": "...", "instructions": "..."}
`
            }
        ],
        temperature: 0.2,
        max_tokens: 300
    });

    const text = completion.choices[0].message.content;
    let personaObj;
    try {
        const match = `${text}`.match(/```json\s*([\s\S]*?)\s*```/i) || `${text}`.match(/```([\s\S]*?)\s*```/i);
        const jsonBlock = match ? match[1] : `${text}`.slice(`${text}`.indexOf("{"));
        personaObj = JSON.parse(jsonBlock || "");
    } catch (err) {
        return ServiceResponse.failure("Failed to parse persona JSON.", { raw: text }, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    // Save to chatbots table (int8 id)
    const { error: upsertError } = await supabase.from("chatbots").upsert({
        id: chatbotId,
        business_name: personaObj.business_name,
        persona: personaObj.persona,
        instructions: personaObj.instructions
    });

    if (upsertError) {
        return ServiceResponse.failure("Failed to upsert chatbot persona.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return ServiceResponse.success("Persona generated and saved.", personaObj);
}
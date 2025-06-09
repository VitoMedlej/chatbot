// Service to auto-generate or upsert a default persona for a chatbot

import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

/**
 * Upserts a default persona for a chatbot using a provided business name.
 */
export async function upsertDefaultPersona(chatbotId: string, businessName: string, personality: string = "friendly"): Promise<ServiceResponse<any>> {
    if (!chatbotId || !businessName) {
        return ServiceResponse.failure("Missing chatbotId or businessName.", null, StatusCodes.BAD_REQUEST);
    }
    let personaText = "You are the helpful assistant for " + businessName + ".";
    let instructions = "Be concise and helpful. Never say you are ChatGPT. Always answer as a representative of the business. If you don't know, suggest contacting support.";
    switch (personality) {
        case "professional":
            personaText = `You are a professional, courteous assistant for ${businessName}.`;
            instructions = "Respond formally and with expertise. Never say you are ChatGPT. Always answer as a representative of the business.";
            break;
        case "enthusiastic":
            personaText = `You are an enthusiastic, upbeat assistant for ${businessName}.`;
            instructions = "Respond with energy and positivity. Never say you are ChatGPT. Always answer as a representative of the business.";
            break;
        case "concise":
            personaText = `You are a concise, efficient assistant for ${businessName}.`;
            instructions = "Keep answers brief and to the point. Never say you are ChatGPT. Always answer as a representative of the business.";
            break;
        case "empathetic":
            personaText = `You are an empathetic, understanding assistant for ${businessName}.`;
            instructions = "Respond with care and understanding. Never say you are ChatGPT. Always answer as a representative of the business.";
            break;
        case "friendly":
        default:
            // Already set
            break;
    }
    const personaObj = {
        business_name: businessName,
        persona: personaText,
        instructions: instructions
    };
    const { error: upsertError } = await supabase.from("chatbots").upsert({
        id: chatbotId,
        business_name: personaObj.business_name,
        persona: personaObj.persona,
        instructions: personaObj.instructions,
        setup_complete: true
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
    const { chatbotId, businessName, personality = "friendly" } = req.body;
    if (!chatbotId) {
        return ServiceResponse.failure("Missing chatbotId.", null, StatusCodes.BAD_REQUEST);
    }
    const { data: chunks, error } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("chatbot_id", chatbotId)
        .limit(5);

    if (error || !chunks || chunks.length === 0) {
        const fallbackName = businessName || "Your Business";
        // Fallback to upsert default persona with personality
        return upsertDefaultPersona(chatbotId, fallbackName, personality);
    }

    const combined = chunks.map(c => c.content).join("\n\n").slice(0, 1000);

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
    } catch {
        return ServiceResponse.failure("Failed to parse persona JSON.", { raw: text }, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    const { error: upsertError } = await supabase.from("chatbots").upsert({
        id: chatbotId,
        business_name: personaObj.business_name,
        persona: personaObj.persona,
        instructions: personaObj.instructions,
        setup_complete: true
    });

    if (upsertError) {
        return ServiceResponse.failure("Failed to upsert chatbot persona.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return ServiceResponse.success("Persona generated and saved.", personaObj);
}
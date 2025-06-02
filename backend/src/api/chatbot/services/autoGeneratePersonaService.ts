import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase, openai } from "@/server";

function extractJsonBlock(text: string): string | null {
    // Remove markdown code block if present
    const match = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```([\s\S]*?)\s*```/i);
    if (match) return match[1];
    // Fallback: try to find first { ... }
    const braceIdx = text.indexOf("{");
    if (braceIdx !== -1) return text.slice(braceIdx);
    return null;
}

export async function autoGeneratePersona(req: any): Promise<ServiceResponse<any>> {
    const { chatbotId } = req.body;
    if (!chatbotId) {
        return ServiceResponse.failure("Missing chatbotId.", null, StatusCodes.BAD_REQUEST);
    }

    // Get the first 5 chunks for this chatbot (no source_url filter)
    const { data: chunks, error } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("chatbot_id", chatbotId)
        .limit(5);

    if (error || !chunks || chunks.length === 0) {
        console.error("[autoGeneratePersona] No content found for persona generation.", error);
        return ServiceResponse.failure("No content found for persona generation.", null, StatusCodes.NOT_FOUND);
    }

    const combined = chunks.map(c => c.content).join("\n\n").slice(0, 3000);

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
    console.log("[autoGeneratePersona] OpenAI raw response:", text);

    let personaObj;
    try {
        const jsonBlock = extractJsonBlock(text || "");
        personaObj = JSON.parse(jsonBlock || "");
    } catch (err) {
        console.error("[autoGeneratePersona] Failed to parse persona JSON. Raw response:", text, "Error:", err);
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
        console.error("[autoGeneratePersona] Failed to upsert chatbot persona.", upsertError);
        return ServiceResponse.failure("Failed to upsert chatbot persona.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }

    return ServiceResponse.success("Persona generated and saved.", personaObj);
}
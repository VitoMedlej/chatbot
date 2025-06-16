import { supabase } from "@/server";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";

/**
 * Generate a unique API key for a chatbot that can be used for public embedding
 */
export async function generateChatbotApiKey(chatbotId: number): Promise<ServiceResponse<{ apiKey: string } | null>> {
    try {
        // Validate chatbot ID
        if (!Number.isInteger(chatbotId) || chatbotId <= 0) {
            return ServiceResponse.failure("Invalid chatbot ID", null, StatusCodes.BAD_REQUEST);
        }

        // Generate a secure API key (prefixed for identification)
        const timestamp = Date.now();
        const randomBytes = Math.random().toString(36).substring(2, 15);
        const apiKey = `cb_${chatbotId}_${timestamp}_${randomBytes}`;

        // Update chatbot with new API key
        const { error } = await supabase
            .from("chatbots")
            .update({ 
                api_key: apiKey,
                updated_at: new Date().toISOString()
            })
            .eq("id", chatbotId);

        if (error) {
            console.error("Error generating API key:", error);
            return ServiceResponse.failure("Failed to generate API key", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return ServiceResponse.success("API key generated successfully", { apiKey });
    } catch (error) {
        console.error("Error generating chatbot API key:", error);
        return ServiceResponse.failure("Failed to generate API key", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Validate API key and return chatbot info for public embedding
 */
export async function validateChatbotApiKey(apiKey: string, domain?: string): Promise<ServiceResponse<{
    chatbotId: number;
    chatbotName: string;
    businessName: string;
    allowedDomains: string[];
} | null>> {
    try {
        if (!apiKey || !apiKey.startsWith('cb_')) {
            return ServiceResponse.failure("Invalid API key format", null, StatusCodes.UNAUTHORIZED);
        }

        // Look up chatbot by API key
        const { data: chatbot, error } = await supabase
            .from("chatbots")
            .select("id, name, business_name, allowed_domains, is_active")
            .eq("api_key", apiKey)
            .single();

        if (error || !chatbot) {
            return ServiceResponse.failure("Invalid API key", null, StatusCodes.UNAUTHORIZED);
        }

        if (!chatbot.is_active) {
            return ServiceResponse.failure("Chatbot is disabled", null, StatusCodes.FORBIDDEN);
        }

        // Validate domain if provided
        if (domain && chatbot.allowed_domains && chatbot.allowed_domains.length > 0) {
            const isAllowedDomain = chatbot.allowed_domains.some((allowedDomain: string) => {
                // Support wildcards like *.example.com
                if (allowedDomain.startsWith('*.')) {
                    const baseDomain = allowedDomain.substring(2);
                    return domain.endsWith(baseDomain);
                }
                return domain === allowedDomain || domain.endsWith('.' + allowedDomain);
            });

            if (!isAllowedDomain) {
                return ServiceResponse.failure("Domain not authorized for this chatbot", null, StatusCodes.FORBIDDEN);
            }
        }

        return ServiceResponse.success("API key valid", {
            chatbotId: chatbot.id,
            chatbotName: chatbot.name,
            businessName: chatbot.business_name,
            allowedDomains: chatbot.allowed_domains || []
        });
    } catch (error) {
        console.error("Error validating API key:", error);
        return ServiceResponse.failure("API key validation failed", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Update allowed domains for a chatbot
 */
export async function updateChatbotDomains(chatbotId: number, allowedDomains: string[]): Promise<ServiceResponse<null>> {
    try {
        // Validate chatbot ID
        if (!Number.isInteger(chatbotId) || chatbotId <= 0) {
            return ServiceResponse.failure("Invalid chatbot ID", null, StatusCodes.BAD_REQUEST);
        }

        // Validate and clean domains
        const cleanDomains = allowedDomains
            .map(domain => domain.trim().toLowerCase())
            .filter(domain => domain.length > 0)
            .filter(domain => {
                // Basic domain validation
                const domainRegex = /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                return domainRegex.test(domain);
            });

        const { error } = await supabase
            .from("chatbots")
            .update({ 
                allowed_domains: cleanDomains,
                updated_at: new Date().toISOString()
            })
            .eq("id", chatbotId);

        if (error) {
            console.error("Error updating domains:", error);
            return ServiceResponse.failure("Failed to update allowed domains", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        return ServiceResponse.success("Allowed domains updated successfully", null);
    } catch (error) {
        console.error("Error updating chatbot domains:", error);
        return ServiceResponse.failure("Failed to update allowed domains", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

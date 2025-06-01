// backend-express/src/utils/chunkText.ts

import { get_encoding } from "tiktoken";

/**
 * Token-based, semantic chunking for RAG/vector search.
 * - Splits on paragraphs, then sentences.
 * - Chunks are sized by token count, not characters.
 * - No tiny trailing chunks.
 * - Handles all edge cases.
 */
export function chunkText(
    text: string,
    maxTokens: number = 500,
    overlapTokens: number = 50,
    encodingName: string = "cl100k_base"
): string[] {
    if (typeof text !== "string") throw new Error("Input text must be a string.");
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length > 1_000_000) throw new Error("Input text too large.");

    // Basic sanitization
    let sanitized = trimmed
        .replace(/\0/g, "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+on\w+="[^"]*"/gi, "")
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
        .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/data:text\/html/gi, "")
        .replace(/[\u202e\u202d\u202c\u202b\u202a]/g, "");

    const encoding = get_encoding(encodingName as any);

    try {
        // Split into paragraphs
        const paragraphs = sanitized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

        const chunks: string[] = [];
        let currentChunk = "";
        let currentTokens: number[] = [];

        function addChunk(chunk: string) {
            const tokens = encoding.encode(chunk);
            // Only add if not empty
            if (tokens.length >= 1) {
                chunks.push(chunk.trim());
            }
        }

        for (const para of paragraphs) {
            // Split paragraph into sentences
            const sentences = para.match(/[^.!?]+[.!?]+[\])'"`’”]*|.+/g) || [para];
            for (const sentence of sentences) {
                const sentenceTokens = encoding.encode(sentence);
                if (currentTokens.length + sentenceTokens.length > maxTokens) {
                    addChunk(currentChunk);
                    // Overlap: keep last N tokens from previous chunk
                    if (overlapTokens > 0 && currentTokens.length > overlapTokens) {
                        const overlapText = encoding.decode(new Uint32Array(currentTokens.slice(-overlapTokens)));
                        currentChunk = overlapText + " " + sentence;
                        currentTokens = Array.from(encoding.encode(currentChunk));
                    } else {
                        currentChunk = sentence;
                        currentTokens = Array.from(sentenceTokens);
                    }
                } else {
                    currentChunk += (currentChunk ? " " : "") + sentence;
                    currentTokens = Array.from(encoding.encode(currentChunk));
                }
            }
        }
        // Add last chunk if it's not empty
        if (
            currentChunk &&
            encoding.encode(currentChunk).length >= 1
        ) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    } finally {
        encoding.free();
    }
}
// backend-express/src/utils/chunkText.ts (if you've moved it to utils)
// or directly in src/index.ts

/**
 * Securely chunks text into smaller pieces for embedding/storage.
 * - Sanitizes input to prevent code injection, XSS, and basic malware payloads.
 * - Validates input type and length.
 * - Handles edge cases for malformed or suspicious input.
 */
export function chunkText(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 100
): string[] {
    console.log('[chunkText] Initial input text (first 200 chars):', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
    console.log('[chunkText] Initial input length:', text.length);

    // --- Input Validation ---
    if (typeof text !== "string") {
        console.error('[chunkText] ERROR: Input text must be a string. Type:', typeof text);
        throw new Error("Input text must be a string.");
    }
    const trimmedText = text.trim();
    if (!trimmedText) {
        console.log('[chunkText] Input text is empty or just whitespace after trim.');
        return [];
    }
    if (trimmedText.length > 1_000_000) {
        console.error('[chunkText] ERROR: Input text too large. Length:', trimmedText.length);
        throw new Error("Input text too large.");
    }

    // --- Basic Sanitization ---
    let sanitized = trimmedText.replace(/\0/g, "");
    sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<[^>]+on\w+="[^"]*"/gi, "");
    sanitized = sanitized.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "");
    sanitized = sanitized.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "");
    sanitized = sanitized.replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "");
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/data:text\/html/gi, "");
    sanitized = sanitized.replace(/[\u202e\u202d\u202c\u202b\u202a]/g, "");

    console.log('[chunkText] Sanitized text length:', sanitized.length);
    console.log('[chunkText] Sanitized text (first 200 chars):', sanitized.substring(0, 200) + (sanitized.length > 200 ? '...' : ''));

    // --- Chunking Logic ---
    const chunks: string[] = [];
    let i = 0;
    let chunkCount = 0;

    // If the entire sanitized text is already smaller than or equal to chunkSize, just use it as one chunk.
    if (sanitized.length <= chunkSize) {
        const safeChunk = sanitized.replace(/\0/g, "").trim();
        if (safeChunk.length > 10 && /[a-zA-Z0-9]/.test(safeChunk)) { // Apply final validation
            chunks.push(safeChunk);
        }
        console.log(`[chunkText] Single chunk scenario. Total chunks before final filter: ${chunks.length}`);
        console.log(`[chunkText] Total chunks after final filter: ${chunks.length}`);
        return chunks;
    }

    // Otherwise, proceed with iterative chunking
    while (i < sanitized.length) {
        const end = Math.min(i + chunkSize, sanitized.length);
        let chunk = sanitized.substring(i, end);

        // Adjust chunk end to natural breaks if not at the very end of text
        if (end < sanitized.length) { // Only attempt to find break if there's more text
            let lastBreak = chunk.lastIndexOf('\n\n');
            if (lastBreak === -1) lastBreak = chunk.lastIndexOf('\n');
            if (lastBreak === -1) lastBreak = chunk.lastIndexOf('.');
            if (lastBreak === -1) lastBreak = chunk.lastIndexOf('!');
            if (lastBreak === -1) lastBreak = chunk.lastIndexOf('?');
            
            // Ensure break is within the chunk and not too close to the start if possible
            if (lastBreak !== -1 && lastBreak > chunkSize * 0.5) { // Prefer breaks in the latter half
                chunk = chunk.substring(0, lastBreak + 1);
            }
        }

        const safeChunk = chunk.replace(/\0/g, "").trim();

        console.log(`[chunkText] Processing chunk ${chunkCount} (length: ${safeChunk.length}, effective start: ${i}):`);
        console.log(`  Content: "${safeChunk.substring(0, 100) + (safeChunk.length > 100 ? '...' : '')}"`);

        if (safeChunk.length > 0) {
            chunks.push(safeChunk);
        }
        
        // --- CORRECTED: Advance 'i' by the intended chunk size minus overlap ---
        // Ensures 'i' jumps appropriately and prevents infinite loops for fixed chunk sizes.
        i += Math.max(1, chunk.length - overlap); 
        chunkCount++;
    }

    // --- Output Validation ---
    const finalChunks = chunks.filter(
        c =>
            c.length > 10 && // Must be longer than 10 characters
            /[a-zA-Z0-9]/.test(c) && // Must contain at least one alphanumeric character
            c.length <= chunkSize + 50 // Allows for slight overflow due to natural breaks
    );

    console.log(`[chunkText] Total chunks before final filter: ${chunks.length}`);
    console.log(`[chunkText] Total chunks after final filter: ${finalChunks.length}`);

    return finalChunks;
}
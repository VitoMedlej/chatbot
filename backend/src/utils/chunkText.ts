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
    // --- Input Validation ---
    if (typeof text !== "string") {
        throw new Error("Input text must be a string.");
    }
    if (!text.trim()) return [];
    if (text.length > 1_000_000) {
        // Arbitrary 1MB limit for safety; adjust as needed
        throw new Error("Input text too large.");
    }

    // --- Basic Sanitization ---
    // Remove null bytes and suspicious unicode
    let sanitized = text.replace(/\0/g, "");
    // Remove common script tags and suspicious HTML
    sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<[^>]+on\w+="[^"]*"/gi, ""); // Remove inline JS events
    sanitized = sanitized.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "");
    sanitized = sanitized.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "");
    sanitized = sanitized.replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "");
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/data:text\/html/gi, "");

    // Remove dangerous unicode control characters
    sanitized = sanitized.replace(/[\u202e\u202d\u202c\u202b\u202a]/g, "");

    // --- Chunking Logic ---
    const chunks: string[] = [];
    let i = 0;
    while (i < sanitized.length) {
        const end = Math.min(i + chunkSize, sanitized.length);
        let chunk = sanitized.substring(i, end);

        let lastBreak = chunk.lastIndexOf('\n\n');
        if (lastBreak === -1) lastBreak = chunk.lastIndexOf('\n');
        if (lastBreak === -1) lastBreak = chunk.lastIndexOf('.');
        if (lastBreak === -1) lastBreak = chunk.lastIndexOf('!');
        if (lastBreak === -1) lastBreak = chunk.lastIndexOf('?');

        if (lastBreak !== -1 && end !== sanitized.length) {
            chunk = sanitized.substring(i, i + lastBreak + 1);
        }

        // Final chunk validation: remove any remaining null bytes, trim, and skip empty
        const safeChunk = chunk.replace(/\0/g, "").trim();
        if (safeChunk.length > 0) {
            chunks.push(safeChunk);
        }
        i += chunk.length - overlap;
        if (i < 0) i = 0;
    }

    // --- Output Validation ---
    // Remove any chunk that is suspiciously short or contains only symbols
    return chunks.filter(
        c =>
            c.length > 10 &&
            /[a-zA-Z0-9]/.test(c) && // Must contain at least one alphanumeric
            c.length <= chunkSize + 50 // Allow a little overflow for natural breaks
    );
}
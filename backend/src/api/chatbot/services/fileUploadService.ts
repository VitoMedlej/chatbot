import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { supabase } from "@/server";
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import pdfParse from "pdf-parse";
import { openai } from "@/server"; // Use shared OpenAI instance
import { insertDocumentChunk } from "@/api/chatbot/services/websiteCrawlService";

const MAX_FILE_SIZE_MB = 5; // Limit file size to 5 MB
const ALLOWED_FILE_TYPES = [".pdf", ".csv", ".txt"]; // Added .txt to allowed file extensions

export async function uploadFile(req: any): Promise<ServiceResponse<any>> {
    let insertedKnowledgeId: number | null = null;
    try {
        const { chatbotId, userId } = req.body;
        if (!chatbotId || !userId) {
            return ServiceResponse.failure("Missing chatbotId or userId.", null, StatusCodes.BAD_REQUEST);
        }

        if (!req.file) {
            return ServiceResponse.failure("No file uploaded.", null, StatusCodes.BAD_REQUEST);
        }

        const file = req.file;
        const filePath = path.resolve(file.path);
        const fileExtension = path.extname(file.originalname).toLowerCase();

        // Validate file type
        if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
            return ServiceResponse.failure(
                `Unsupported file type. Allowed types are: ${ALLOWED_FILE_TYPES.join(", ")}`,
                null,
                StatusCodes.BAD_REQUEST
            );
        }

        // Validate file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            return ServiceResponse.failure(
                `File size exceeds the limit of ${MAX_FILE_SIZE_MB} MB.`,
                null,
                StatusCodes.BAD_REQUEST
            );
        }

        let content = "";

        // Handle PDF files
        if (fileExtension === ".pdf") {
            const pdfBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(pdfBuffer);
            content = pdfData.text;
        }
        // Handle CSV files
        else if (fileExtension === ".csv") {
            const rows: string[] = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csvParser())
                    .on("data", (row) => rows.push(JSON.stringify(row)))
                    .on("end", resolve)
                    .on("error", reject);
            });
            content = rows.join("\n");
        }
        // Handle TXT files
        else if (fileExtension === ".txt") {
            const txtData = fs.readFileSync(filePath, "utf-8");
            content = sanitizeText(txtData);
        }

        // Deduplicate: check if content already exists for this chatbot and file name/content
        const { data: existing, error: existingError } = await supabase
            .from("chatbot_knowledge")
            .select("id")
            .eq("chatbot_id", chatbotId)
            .eq("title", file.originalname)
            .eq("content", content);
        if (existingError) {
            return ServiceResponse.failure("Failed to check for duplicates.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        if (existing && existing.length > 0) {
            return ServiceResponse.success("Duplicate file content detected. Skipping ingestion.", null);
        }

        // Insert into chatbot_knowledge first
        const { data: inserted, error: knowledgeError } = await supabase.from("chatbot_knowledge").insert([
            {
                chatbot_id: chatbotId,
                user_id: userId,
                source_type: "file",
                source_name: file.originalname,
                title: file.originalname,
                description: null,
                content,
                links: null,
                buttons: null,
                metadata: null
            }
        ]).select();
        if (knowledgeError) {
            return ServiceResponse.failure("Failed to save knowledge.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }
        insertedKnowledgeId = inserted && inserted[0] && inserted[0].id ? inserted[0].id : null;

        // Split content into chunks
        const chunks = chunkText(content);

        const url = "uploaded-file"; // Placeholder for source URL
        const pageTitle = file.originalname; // Use file name as title
        const linksArray: string[] = []; // No links for uploaded files

        // Embed and store chunks
        try {
            const embeddingPromises = chunks.map(async (chunk) => {
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunk,
                });
                const embedding = embeddingResponse.data[0].embedding;
                await insertDocumentChunk(chatbotId, chunk, embedding, url, pageTitle, linksArray);
            });
            await Promise.all(embeddingPromises);
        } catch (embedErr: any) {
            // Rollback: delete the just-inserted chatbot_knowledge row
            if (insertedKnowledgeId) {
                await supabase.from("chatbot_knowledge").delete().eq("id", insertedKnowledgeId);
            }
            return ServiceResponse.failure("Failed to embed file content. Rolled back knowledge base entry.", null, StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // Mark chatbot as setup_complete after successful file ingest
        await supabase
            .from("chatbots")
            .update({ setup_complete: true })
            .eq("id", chatbotId);

        return ServiceResponse.success("File uploaded and content embedded.", null);
    } catch (err: any) {
        // Rollback: delete the just-inserted chatbot_knowledge row if present
        if (insertedKnowledgeId) {
            await supabase.from("chatbot_knowledge").delete().eq("id", insertedKnowledgeId);
        }
        return ServiceResponse.failure(`Failed to process file upload: ${err.message}`, null, StatusCodes.INTERNAL_SERVER_ERROR);
    } finally {
        // Clean up uploaded file
        if (req.file?.path) {
            fs.unlinkSync(req.file.path);
        }
    }
}

function chunkText(text: string, chunkSize = 2000): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

function sanitizeText(text: string): string {
    return text
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+on\w+="[^"]*"/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/data:text\/html/gi, "")
        .replace(/\0/g, "")
        .replace(/[\u202e\u202d\u202c\u202b\u202a]/g, "");
}
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
    try {
        const { chatbotId } = req.body;
        if (!chatbotId) {
            return ServiceResponse.failure("Missing chatbotId.", null, StatusCodes.BAD_REQUEST);
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

        // Split content into chunks
        const chunks = chunkText(content);

        const url = "uploaded-file"; // Placeholder for source URL
        const pageTitle = file.originalname; // Use file name as title
        const linksArray: string[] = []; // No links for uploaded files

        // Embed and store chunks
        const embeddingPromises = chunks.map(async (chunk) => {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
            });
            const embedding = embeddingResponse.data[0].embedding;
            await insertDocumentChunk(chatbotId, chunk, embedding, url, pageTitle, linksArray);
        });

        await Promise.all(embeddingPromises);

        return ServiceResponse.success("File uploaded and content embedded.", null);
    } catch (err: any) {
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
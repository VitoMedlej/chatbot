import cors from "cors";
import express, { type Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
// NEW: For environment variables (like API keys)
import dotenv from "dotenv";
// NEW: For OpenAI API interactions
import { OpenAI } from "openai";
// NEW: For Supabase (Database & Auth) interactions
import { createClient } from "@supabase/supabase-js";
// Keeping rate limiter, as it was in your old package.json and is a good practice
import rateLimit from "express-rate-limit";
import { chatbotRouter } from "./api/chatbot/chatbotRouter";


// --- Load Environment Variables ---
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000; // Default to 4000 for backend



export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string // Use the service_role key for backend operations
);


// --- Middleware Setup ---

// Basic CORS configuration
const allowedOrigins = [
  "http://localhost:3000", // Your Dashboard Frontend (Next.js default dev port)
  "http://localhost:3001", // Your Embeddable Chatbot Frontend (if on another port)
  // !!! IMPORTANT: Add your production frontend domains here when deployed to Vercel etc. !!!
  // e.g., "https://your-dashboard.vercel.app",
  // e.g., "https://your-chatbot-embed.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like direct API calls or mobile apps)
      // or if it's a whitelisted origin, or in development mode
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Keep relevant methods
    allowedHeaders: ["Content-Type", "Authorization", "x-chatbot-id"], // Add headers your frontends will send
    credentials: true, // If you need to send cookies/auth headers
  })
);

// Helmet for basic security headers
app.use(helmet());

// Trust proxy for proper IP detection when deployed behind a load balancer/proxy
// app.set("trust proxy", true);

// Parse JSON and URL-encoded request bodies
app.use(express.json({ limit: '50mb' })); // Increase limit for potentially large text inputs
app.use(express.urlencoded({ extended: true }));

// Global Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use(apiLimiter); // Apply this to all routes

// Handle preflight OPTIONS requests for CORS (often handled by `cors` middleware, but good to have explicit)
app.options('*', cors());
app.options("/api/*", (req, res) => {
  res.sendStatus(204); // No content, but preflight is successful
});


// --- ROUTE IMPORTS (Placeholders for your new, separate route files) ---
// You will create these files next.
// Example:
// import { chatbotRoutes } from "./routes/chatbotRoutes";
// import { managementRoutes } from "./routes/managementRoutes";
// import { healthCheckRouter } from "./api/healthCheck/healthCheckRouter"; // Assuming this is a simple self-contained file

// --- Health Check Route (Keeping it simple) ---
// You can keep this route here or move it to a specific healthCheckRouter.ts
app.get("/api/health-check", (req, res) => {
  res.status(200).json({ status: "ok", message: "Chatbot Backend is running!" });
});
app.use("/api/chatbot", chatbotRouter);

// --- Apply Your New Routes Here ---
// app.use("/api", chatbotRoutes);     // Example: for /api/ingest-text, /api/chat
// app.use("/api", managementRoutes);  // Example: for /api/create-chatbot, /api/my-chatbots


// --- Global Error Handler (Last Middleware) ---
// This catches any errors thrown by your routes or other middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('An unhandled error occurred:', err); // Log the error for debugging
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred.';
  res.status(statusCode).json({
    error: {
      message: message,
      // Only send stack trace in development for security
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

export const logger = {
  error : (log : any) => {
      console.log(`Error: ${log}`);
  },
  info : (log : any) => {
      console.log(`Info: ${log}`)},
  warn : (log : any) => {
      console.log(`Warning: ${log}`);
  }
}


// --- Start the Server ---
// app.listen(port, () => {
//   console.log(`Chatbot Backend Server running on http://localhost:${port}`);
//   console.log(`OpenAI and Supabase clients initialized.`);
//   console.log(`Remember to set up your Supabase project (pgvector extension, 'chatbots' and 'document_chunks' tables, and 'match_documents' RPC function)!`);
// });

export default app;
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
import { healthCheckRouter } from "./api/healthCheck/healthCheckRouter";
import authenticateRequest from "./common/middleware/authHandler"; // THIS IS THE MIDDLEWARE
import { sanitizeInput } from "./common/middleware/inputValidation";
import { env } from "./common/utils/envConfig";


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

// Production-ready CORS configuration
const allowedOrigins = env.NODE_ENV === 'production' 
  ? [
      env.FRONTEND_URL || "https://your-dashboard.vercel.app",
      env.EMBED_FRONTEND_URL || "https://your-chatbot-embed.vercel.app",
      // Add other production domains as needed
    ]
  : [
      "http://localhost:3000", // Dashboard Frontend (Next.js default dev port)
      "http://localhost:3001", // Embeddable Chatbot Frontend
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];

app.use(
  cors({    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, postman, etc.) only in development
      if (!origin && env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin || '')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Keep relevant methods
    allowedHeaders: ["Content-Type", "Authorization", "x-chatbot-id"], // Add headers your frontends will send
    credentials: true, // If you need to send cookies/auth headers
  })
);

// Helmet for comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Trust proxy for proper IP detection when deployed behind a load balancer/proxy
app.set("trust proxy", 1);

// Parse JSON and URL-encoded request bodies
app.use(express.json({ limit: '1mb' })); // Increase limit for potentially large text inputs
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply input sanitization to all routes
app.use(sanitizeInput);

// Production-ready Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'production' ? 100 : 1000, // Stricter limits in production
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health-check';
  }
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

// --- Health Check Route (Public - No Auth Required) ---
app.get("/api/health-check", (req, res) => {
  res.status(200).json({ status: "ok", message: "Chatbot Backend is running!" });
});

// Public routes (no authentication required)
app.use("/health-check", healthCheckRouter);

// Protected routes (authentication required)
app.use("/api/chatbot", authenticateRequest, chatbotRouter); // This line is correct

// --- Apply Your New Routes Here ---
// app.use("/api", chatbotRoutes);     // Example: for /api/ingest-text, /api/chat
// app.use("/api", managementRoutes);  // Example: for /api/create-chatbot, /api/my-chatbots


// --- Global Error Handler (Last Middleware) ---
// This catches any errors thrown by your routes or other middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('An unhandled error occurred:', err); // Log the error for debugging
  
  const statusCode = err.statusCode || 500;
    // Don't expose internal error details in production
  const message = env.NODE_ENV === 'production' 
    ? (statusCode === 500 ? 'Internal server error' : err.message || 'An error occurred')
    : (err.message || 'An unexpected server error occurred.');
  
  const errorResponse: any = {
    error: {
      message: message,
      status: statusCode,
      timestamp: new Date().toISOString(),
    },
  };
    // Only send stack trace in development for security
  if (env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
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
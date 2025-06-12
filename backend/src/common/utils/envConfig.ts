import dotenv from "dotenv";
import { cleanEnv, host, num, port, str, testOnly, url } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ devDefault: testOnly("test"), choices: ["development", "production", "test"] }),
  HOST: host({ devDefault: testOnly("localhost") }),
  PORT: port({ devDefault: testOnly(3000) }),
  CORS_ORIGIN: str({ devDefault: testOnly("http://localhost:3000") }),
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(1000) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(1000) }),
  JWT_SECRET: str({ desc: "Secret key for JWT token signing" }),
  MONGODB_CONNECTION: str({ desc: "MongoDB connection string" }),
  MONGO_DB_NAME: str({ desc: "MongoDB database name" }),
  OPENAI_API_KEY: str({ desc: "OpenAI API key for AI functionality" }),
  SUPABASE_URL: url({ desc: "Supabase project URL" }),
  SUPABASE_SERVICE_KEY: str({ desc: "Supabase service role key" }),
  
  // Production-specific environment variables
  FRONTEND_URL: str({ default: "", desc: "Production frontend URL" }),
  EMBED_FRONTEND_URL: str({ default: "", desc: "Production embed frontend URL" }),
});

import { cleanEnv, port, str, url, bool, num } from "envalid";

// Production-ready environment configuration
export const env = cleanEnv(process.env, {
  // Server Configuration
  NODE_ENV: str({ choices: ["development", "production", "test"], default: "development" }),
  PORT: port({ default: 3000 }),
  
  // API Configuration
  API_BASE_URL: url({ 
    desc: "Base URL for the API (used in embed widgets)",
    example: "https://api.yourapp.com"
  }),
  FRONTEND_URL: url({ 
    desc: "Frontend application URL",
    example: "https://yourapp.com"
  }),
  
  // Authentication & Security
  JWT_SECRET: str({ 
    desc: "JWT signing secret - must be strong in production" 
  }),
  CORS_ORIGIN: str({ 
    desc: "Allowed CORS origins (comma-separated)",
    default: "*"
  }),
  
  // Database Configuration
  SUPABASE_URL: url({ desc: "Supabase project URL" }),
  SUPABASE_ANON_KEY: str({ desc: "Supabase anonymous key" }),
  SUPABASE_SERVICE_ROLE_KEY: str({ desc: "Supabase service role key" }),
  
  // OpenAI Configuration
  OPENAI_API_KEY: str({ desc: "OpenAI API key" }),
  OPENAI_ORG_ID: str({ desc: "OpenAI organization ID", default: "" }),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: num({ default: 15 * 60 * 1000 }), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),
  EMBED_RATE_LIMIT_MAX: num({ default: 50 }),
  
  // Security
  BCRYPT_SALT_ROUNDS: num({ default: 12 }),
  HELMET_ENABLED: bool({ default: true }),
  
  // Monitoring & Analytics
  ENABLE_REQUEST_LOGGING: bool({ default: true }),
  LOG_LEVEL: str({ choices: ["error", "warn", "info", "debug"], default: "info" }),
  
  // Optional: External Services
  SENTRY_DSN: str({ default: "", desc: "Sentry DSN for error monitoring" }),
  REDIS_URL: str({ default: "", desc: "Redis URL for caching and rate limiting" }),
});

// Derived configuration
export const config = {
  // Environment
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  
  // Server
  port: env.PORT,
  apiBaseUrl: env.API_BASE_URL,
  frontendUrl: env.FRONTEND_URL,
  
  // CORS
  corsOrigins: env.CORS_ORIGIN.split(",").map(origin => origin.trim()),
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    embedMax: env.EMBED_RATE_LIMIT_MAX,
  },
  
  // Security
  security: {
    jwtSecret: env.JWT_SECRET,
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    helmetEnabled: env.HELMET_ENABLED,
  },
  
  // Database
  database: {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // OpenAI
  openai: {
    apiKey: env.OPENAI_API_KEY,
    orgId: env.OPENAI_ORG_ID,
  },
  
  // Monitoring
  monitoring: {
    enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    logLevel: env.LOG_LEVEL,
    sentryDsn: env.SENTRY_DSN,
  },
  
  // Cache
  redis: {
    url: env.REDIS_URL,
    enabled: Boolean(env.REDIS_URL),
  },
} as const;

// Validation for production
if (config.isProduction) {
  if (!env.API_BASE_URL) {
    throw new Error("API_BASE_URL is required in production");
  }
  if (!env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL is required in production");
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
}

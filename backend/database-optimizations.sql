-- Production Database Optimization Script for Chatbot System
-- Run these commands in your Supabase SQL editor to optimize performance

-- 1. Index for chat_history queries (frequent lookups by user_id and chatbot_id)
CREATE INDEX IF NOT EXISTS idx_chat_history_user_chatbot_time 
ON chat_history (user_id, chatbot_id, created_at DESC);

-- 2. Index for document_chunks chatbot lookups (for vector search pre-filtering)
CREATE INDEX IF NOT EXISTS idx_document_chunks_chatbot 
ON document_chunks (chatbot_id);

-- 3. Index for chatbot_knowledge queries
CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_chatbot_user 
ON chatbot_knowledge (chatbot_id, user_id);

-- 4. Index for chatbots table (user lookups)
CREATE INDEX IF NOT EXISTS idx_chatbots_user_id 
ON chatbots (user_id);

-- 5. Composite index for frequent chat history queries with ordering
CREATE INDEX IF NOT EXISTS idx_chat_history_recent 
ON chat_history (chatbot_id, created_at DESC, sender);

-- 6. Analyze tables to update statistics for query planner
ANALYZE chat_history;
ANALYZE document_chunks;
ANALYZE chatbot_knowledge;
ANALYZE chatbots;

-- 7. Enable parallel processing for vector operations (if supported)
-- Note: This depends on your Supabase plan and instance configuration
-- ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
-- ALTER SYSTEM SET max_parallel_workers = 8;

-- 8. Add embed-specific columns to chatbots table for public embedding
ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] DEFAULT '{}';
ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 9. Index for API key lookups (for public embed authentication)
CREATE INDEX IF NOT EXISTS idx_chatbots_api_key 
ON chatbots (api_key) WHERE api_key IS NOT NULL;

-- 10. Index for active chatbots
CREATE INDEX IF NOT EXISTS idx_chatbots_active 
ON chatbots (is_active) WHERE is_active = TRUE;

-- 11. Vacuum and analyze for better performance
VACUUM ANALYZE chat_history;
VACUUM ANALYZE document_chunks;
VACUUM ANALYZE chatbot_knowledge;
VACUUM ANALYZE chatbots;

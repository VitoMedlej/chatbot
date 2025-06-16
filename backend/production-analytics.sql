-- Production Analytics and Monitoring Tables

-- 1. Create embed analytics table for usage tracking and billing
CREATE TABLE IF NOT EXISTS embed_analytics (
    id BIGSERIAL PRIMARY KEY,
    api_key TEXT NOT NULL,
    chatbot_id INTEGER NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('message_sent', 'widget_loaded', 'session_started', 'config_loaded', 'error')),
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_embed_analytics_chatbot_id 
ON embed_analytics (chatbot_id);

CREATE INDEX IF NOT EXISTS idx_embed_analytics_api_key 
ON embed_analytics (api_key);

CREATE INDEX IF NOT EXISTS idx_embed_analytics_created_at 
ON embed_analytics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embed_analytics_event_type 
ON embed_analytics (event_type);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_embed_analytics_chatbot_time 
ON embed_analytics (chatbot_id, created_at DESC);

-- 3. Create embed sessions table for conversation tracking
CREATE TABLE IF NOT EXISTS embed_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    api_key TEXT NOT NULL,
    chatbot_id INTEGER NOT NULL REFERENCES chatbots(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT
);

-- 4. Create unique constraint for session tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_embed_sessions_session_id 
ON embed_sessions (session_id);

CREATE INDEX IF NOT EXISTS idx_embed_sessions_chatbot_id 
ON embed_sessions (chatbot_id);

CREATE INDEX IF NOT EXISTS idx_embed_sessions_api_key 
ON embed_sessions (api_key);

-- 5. Create embed rate limiting table (if not using Redis)
CREATE TABLE IF NOT EXISTS embed_rate_limits (
    id BIGSERIAL PRIMARY KEY,
    api_key TEXT NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for rate limiting windows
CREATE UNIQUE INDEX IF NOT EXISTS idx_embed_rate_limits_api_key_window 
ON embed_rate_limits (api_key, window_start);

-- 6. Add production performance settings
-- Set work_mem for better query performance
SET work_mem = '256MB';

-- Enable parallel workers for large analytics queries
ALTER TABLE embed_analytics SET (parallel_workers = 4);

-- 7. Create view for common analytics queries
CREATE OR REPLACE VIEW embed_usage_summary AS
SELECT 
    chatbot_id,
    api_key,
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE event_type = 'message_sent') as messages,
    COUNT(*) FILTER (WHERE event_type = 'session_started') as sessions,
    COUNT(*) FILTER (WHERE event_type = 'widget_loaded') as widget_loads,
    COUNT(DISTINCT ip_address) as unique_visitors
FROM embed_analytics
GROUP BY chatbot_id, api_key, DATE(created_at)
ORDER BY date DESC;

-- 8. Create function for automated cleanup of old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_embed_analytics()
RETURNS void AS $$
BEGIN
    -- Delete analytics data older than 90 days
    DELETE FROM embed_analytics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete rate limit data older than 1 day
    DELETE FROM embed_rate_limits 
    WHERE created_at < NOW() - INTERVAL '1 day';
    
    -- Delete inactive sessions older than 7 days
    DELETE FROM embed_sessions 
    WHERE last_activity < NOW() - INTERVAL '7 days';
    
    -- Vacuum tables to reclaim space
    VACUUM ANALYZE embed_analytics;
    VACUUM ANALYZE embed_rate_limits;
    VACUUM ANALYZE embed_sessions;
END;
$$ LANGUAGE plpgsql;

-- 9. Create automated cleanup job (run daily)
-- Note: This requires pg_cron extension
-- SELECT cron.schedule('cleanup-embed-analytics', '0 2 * * *', 'SELECT cleanup_old_embed_analytics();');

-- 10. Grant necessary permissions
-- GRANT SELECT, INSERT ON embed_analytics TO anon;
-- GRANT SELECT, INSERT, UPDATE ON embed_rate_limits TO anon;
-- GRANT SELECT, INSERT, UPDATE ON embed_sessions TO anon;

-- 11. Create chatbot embed configuration columns (if not exists)
ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS embed_config JSONB DEFAULT '{
    "theme": {
        "primaryColor": "#2563eb",
        "backgroundColor": "#ffffff", 
        "textColor": "#374151",
        "borderRadius": "8px"
    },
    "behavior": {
        "showBranding": true,
        "autoOpen": false,
        "position": "bottom-right"
    },
    "features": {
        "fileUpload": false,
        "voiceInput": false,
        "analytics": true
    }
}';

-- 12. Performance monitoring
ANALYZE chatbots;
ANALYZE embed_analytics;
ANALYZE embed_sessions;
ANALYZE embed_rate_limits;

-- 13. Create alerts/monitoring functions
CREATE OR REPLACE FUNCTION get_embed_health_check()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_active_chatbots', (
            SELECT COUNT(DISTINCT chatbot_id) 
            FROM embed_analytics 
            WHERE created_at > NOW() - INTERVAL '1 hour'
        ),
        'messages_last_hour', (
            SELECT COUNT(*) 
            FROM embed_analytics 
            WHERE event_type = 'message_sent' 
            AND created_at > NOW() - INTERVAL '1 hour'
        ),
        'errors_last_hour', (
            SELECT COUNT(*) 
            FROM embed_analytics 
            WHERE event_type = 'error' 
            AND created_at > NOW() - INTERVAL '1 hour'
        ),
        'avg_response_time', '< 500ms',  -- You'd calculate this from your logs
        'status', CASE 
            WHEN (SELECT COUNT(*) FROM embed_analytics WHERE created_at > NOW() - INTERVAL '5 minutes') > 0 
            THEN 'healthy' 
            ELSE 'idle' 
        END,
        'last_check', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

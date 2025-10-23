-- Create application logs table for centralized logging
CREATE TABLE application_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    correlation_id VARCHAR(50),
    service VARCHAR(50) NOT NULL DEFAULT 'vilnius-assistant-backend',
    module VARCHAR(100),
    message TEXT NOT NULL,
    user_id VARCHAR(50),
    metadata JSONB,
    stack TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_application_logs_timestamp ON application_logs(timestamp);
CREATE INDEX idx_application_logs_level ON application_logs(level);
CREATE INDEX idx_application_logs_correlation_id ON application_logs(correlation_id);
CREATE INDEX idx_application_logs_user_id ON application_logs(user_id);
CREATE INDEX idx_application_logs_module ON application_logs(module);

-- Create partial index for error logs (most commonly queried)
CREATE INDEX idx_application_logs_errors ON application_logs(timestamp) WHERE level = 'error';

-- Create composite index for common queries
CREATE INDEX idx_application_logs_level_timestamp ON application_logs(level, timestamp DESC);

-- Optional: Create a function to automatically cleanup old logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM application_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
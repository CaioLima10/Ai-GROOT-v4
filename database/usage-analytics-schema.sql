-- Analytics and error observability tables for GIOM
-- Run in Supabase SQL Editor if you want analytics warnings to disappear

CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT,
  response TEXT,
  response_time INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'unknown',
  user_style TEXT NOT NULL DEFAULT 'natural',
  confidence REAL NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  knowledge_found INTEGER NOT NULL DEFAULT 0,
  bugs_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id
  ON public.usage_analytics (user_id);

CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at
  ON public.usage_analytics (created_at DESC);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id
  ON public.error_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON public.error_logs (created_at DESC);

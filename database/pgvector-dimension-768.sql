-- Migração de embeddings para 768 dimensões
-- Execute no Supabase SQL Editor antes de mudar o app para 768
-- Depois reingira a base curada para regenerar os vetores

-- ⚠️ Esta migração remove os vetores atuais.

DROP INDEX IF EXISTS idx_knowledge_embeddings_vector;
DROP INDEX IF EXISTS idx_bugs_knowledge_vector;
DROP INDEX IF EXISTS idx_code_knowledge_vector;

DROP FUNCTION IF EXISTS search_knowledge(VECTOR(384), FLOAT, INT);
DROP FUNCTION IF EXISTS search_bugs(VECTOR(384), TEXT, FLOAT, INT);
DROP FUNCTION IF EXISTS search_knowledge(VECTOR(768), FLOAT, INT);
DROP FUNCTION IF EXISTS search_bugs(VECTOR(768), TEXT, FLOAT, INT);

ALTER TABLE IF EXISTS knowledge_embeddings
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS knowledge_embeddings
  ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

ALTER TABLE IF EXISTS bugs_knowledge
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS bugs_knowledge
  ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

ALTER TABLE IF EXISTS code_knowledge
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS code_knowledge
  ADD COLUMN IF NOT EXISTS embedding VECTOR(768);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector ON knowledge_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_bugs_knowledge_vector ON bugs_knowledge
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_code_knowledge_vector ON code_knowledge
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.source,
    ke.category,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings ke
  WHERE 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION search_bugs(
  query_embedding VECTOR(768),
  language_param TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 3
)
RETURNS TABLE(
  id BIGINT,
  error_message TEXT,
  solution TEXT,
  language TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bk.id,
    bk.error_message,
    bk.solution,
    bk.language,
    1 - (bk.embedding <=> query_embedding) AS similarity
  FROM bugs_knowledge bk
  WHERE 1 - (bk.embedding <=> query_embedding) > match_threshold
    AND (language_param IS NULL OR bk.language = language_param)
  ORDER BY bk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMIT;

-- Fix de dimensão de embeddings (384) para uso com GrootFreeEmbeddings
-- Execute no Supabase SQL Editor

-- ⚠️ Isso remove os embeddings atuais (regerar depois).

-- Knowledge embeddings
ALTER TABLE IF EXISTS knowledge_embeddings
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS knowledge_embeddings
  ADD COLUMN IF NOT EXISTS embedding VECTOR(384);

-- Bugs knowledge
ALTER TABLE IF EXISTS bugs_knowledge
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS bugs_knowledge
  ADD COLUMN IF NOT EXISTS embedding VECTOR(384);

-- Code knowledge
ALTER TABLE IF EXISTS code_knowledge
  DROP COLUMN IF EXISTS embedding;
ALTER TABLE IF EXISTS code_knowledge
  ADD COLUMN IF NOT EXISTS embedding VECTOR(384);

-- Recriar índices vetoriais
DROP INDEX IF EXISTS idx_knowledge_embeddings_vector;
DROP INDEX IF EXISTS idx_bugs_knowledge_vector;
DROP INDEX IF EXISTS idx_code_knowledge_vector;

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_bugs_knowledge_vector ON bugs_knowledge 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_code_knowledge_vector ON code_knowledge 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMIT;

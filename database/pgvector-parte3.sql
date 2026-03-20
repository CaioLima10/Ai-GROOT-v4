-- GROOT VECTOR DATABASE - PARTE 3 (FUNÇÕES)
-- Execute depois da Parte 2

-- 9. Função de busca semântica
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding VECTOR(384),
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

-- 10. Função de busca de bugs
CREATE OR REPLACE FUNCTION search_bugs(
  query_embedding VECTOR(384),
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

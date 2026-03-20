-- GROOT VECTOR DATABASE - PARTE 2 (RLS E POLÍTICAS)
-- Execute depois da Parte 1

-- 7. Habilitar RLS
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_knowledge ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS (ignorar se já existirem)
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON knowledge_embeddings
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON knowledge_embeddings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON bugs_knowledge
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON bugs_knowledge
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON code_knowledge
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for authenticated users" ON code_knowledge
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

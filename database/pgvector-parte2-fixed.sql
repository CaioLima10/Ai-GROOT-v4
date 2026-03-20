-- GROOT VECTOR DATABASE - PARTE 2 (RLS E POLÍTICAS) - CORRIGIDO
-- Execute depois da Parte 1

-- 7. Habilitar RLS
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_knowledge ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS (versão sem IF NOT EXISTS)
-- Se der erro de "already exists", ignore e continue para a próxima parte

-- Knowledge embeddings policies
CREATE POLICY "Enable read access for all users" ON knowledge_embeddings
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON knowledge_embeddings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Bugs knowledge policies
CREATE POLICY "Enable read access for all users" ON bugs_knowledge
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON bugs_knowledge
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Code knowledge policies
CREATE POLICY "Enable read access for all users" ON code_knowledge
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON code_knowledge
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

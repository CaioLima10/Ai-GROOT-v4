-- GROOT VECTOR DATABASE - PARTE 4 (TRIGGERS E DADOS)
-- Execute depois da Parte 3

-- 11. Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Triggers para atualizar timestamp
CREATE TRIGGER IF NOT EXISTS update_knowledge_embeddings_updated_at 
BEFORE UPDATE ON knowledge_embeddings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_bugs_knowledge_updated_at 
BEFORE UPDATE ON bugs_knowledge
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_code_knowledge_updated_at 
BEFORE UPDATE ON code_knowledge
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. Inserir conhecimento base
INSERT INTO knowledge_embeddings (content, source, category, language, metadata)
VALUES 
  ('Eu sou GROOT, uma inteligência artificial avançada criada em 17/03/2026 por Gabriel Lima de Souza. Minha missão é ajudar desenvolvedores com código, debugging e aprendizado.', 'system', 'identity', 'pt', '{"type": "core", "priority": "high"}'),
  ('JavaScript é uma linguagem de programação usada para criar interatividade em páginas web. É executada no navegador e permite manipular DOM, fazer requisições HTTP e criar aplicações dinâmicas.', 'internal', 'programming', 'pt', '{"language": "javascript", "level": "basic"}'),
  ('Node.js é um runtime JavaScript que permite executar JavaScript no servidor. Criado com base no V8 Engine do Chrome, é usado para construir APIs e aplicações backend.', 'internal', 'programming', 'pt', '{"language": "javascript", "level": "intermediate"}')
ON CONFLICT DO NOTHING;

-- 14. Inserir bugs base
INSERT INTO bugs_knowledge (error_message, solution, language, confidence)
VALUES 
  ('ReferenceError: variable is not defined', 'Verifique se a variável foi declarada antes de usar. Use let, const ou var para declarar variáveis.', 'javascript', 0.9),
  ('TypeError: Cannot read property of undefined', 'Verifique se o objeto existe antes de acessar suas propriedades. Use optional chaining (?.) ou verificação com if.', 'javascript', 0.9),
  ('SyntaxError: Unexpected token', 'Verifique a sintaxe do seu código. Pode estar faltando uma vírgula, parêntese ou ponto e vírgula.', 'javascript', 0.8)
ON CONFLICT DO NOTHING;

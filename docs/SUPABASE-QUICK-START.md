# 🚀 GUIA RÁPIDO - CRIAR PROJETO SUPABASE

## 📋 PASSO A PASSO (COPIE E COLE)

### 1️⃣ ACESSAR SUPABASE
1. Abra: https://supabase.com
2. Faça login com GitHub ou Google
3. Clique em "New Project"
4. Nome do projeto: `groot-memory`
5. Aguarde provisioning (2-3 minutos)

### 2️⃣ OBTER CREDENCIAIS
1. No projeto criado → Settings → Database
2. Copie "Connection string"
3. Copie "anon public" key
4. Copie "service_role" key (para backend)
4. Anote os valores:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3️⃣ ATUALIZAR .ENV
1. Abra: `c:\Users\GabeG\Desktop\Ai-GROOT\.env`
2. Substitua os placeholders:

```env
# Substitua pelos valores reais do Supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA-CHAVE-ANON-REAL
SUPABASE_SERVICE_KEY=SUA-CHAVE-SERVICE-REAL

# Mantenha as outras chaves existentes
GROQ_API_KEY=sua_groq_api_key_aqui
GEMINI_API_KEY=AIzaSyDummyKeyForTesting
OPENROUTER_KEY=sk-or-v1-dummykey123
HUGGINGFACE_API_KEY=hf_dummykey123

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 4️⃣ EXECUTAR SCHEMA
1. Abra: https://supabase.com/dashboard/project/groot-memory/sql
2. Cole o conteúdo de `database/supabase-schema.sql`
3. Clique em "Run" ou "Execute"
4. Aguarde conclusão

### 5️⃣ TESTAR CONEXÃO
Execute este comando para testar:
```bash
node -e "
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na conexão:', error.message);
    } else {
      console.log('✅ Conexão Supabase OK!');
      console.log('📊 Count:', data[0]?.count || 0);
    }
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

testConnection();
"
```

---

## 🎯 O QUE ESTE GUIA FAZ:

### ✅ Criação do Projeto
- Nome definido: `groot-memory`
- Passos detalhados para obter credenciais

### ✅ Configuração do Ambiente
- Atualização do .env com placeholders reais
- Mantém configurações existentes

### ✅ Schema Database
- Execução do SQL completo
- Criação de todas as tabelas necessárias

### ✅ Teste de Validação
- Comando Node.js para testar conexão
- Verificação se tudo está funcionando

---

## 🚨 PRÓXIMO PASSO

Depois de seguir este guia:

1. **Teste a conexão** com o comando acima
2. **Se funcionar** → GROOT estará 100% pronto!
3. **Se der erro** → Me envie o erro para corrigir

---

## 📋 STATUS ATUAL

### ✅ Implementado (90%):
- LLM Real + Personalidade + Memória Local + RAG

### ❌ Pendente (10%):
- Conexão Supabase real

---

**Execute este guia AGORA e me diga o resultado!** 🚀

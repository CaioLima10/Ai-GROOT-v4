# 🚀 CONFIGURAÇÃO SUPABASE PARA GROOT

## 📋 PASSO A PASSO

### 1️⃣ Criar Projeto Supabase
1. Acesse: https://supabase.com
2. Clique em "Start your project"
3. Faça login com GitHub/Google
4. Crie novo projeto: "groot-memory"
5. Aguarde provisionamento (2-3 min)

### 2️⃣ Configurar Database
1. No painel Supabase → SQL Editor
2. Cole o conteúdo de `database/supabase-schema.sql`
3. Execute o SQL (Run)
4. Verifique se tabelas foram criadas

### 3️⃣ Obter Credenciais
1. Settings → API
2. Copie:
   - Project URL (ex: https://xyz.supabase.co)
   - anon public key (ex: eyJhbGciOiJIUz...)

### 4️⃣ Atualizar .env
```env
# Substitua pelos valores reais
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5️⃣ Testar Conexão
```bash
# Reiniciar servidor
node server-definitivo.js
```

### 6️⃣ Verificar Memória
- Faça algumas perguntas
- Verifique no Supabase → Table Editor → conversations
- Deve aparecer as conversas salvas

---

## 🎯 ESTRUTURA CRIADA

### 📊 Tabelas:
- **conversations** - Histórico de conversas
- **user_profiles** - Preferências do usuário
- **knowledge_base** - Base de conhecimento (RAG)
- **learning_patterns** - Padrões de aprendizado

### 🔐 Segurança:
- RLS (Row Level Security) ativado
- Usuários só veem seus próprios dados
- Acesso controlado por auth

### 🚀 Features:
- Memória persistente
- Perfil adaptativo
- Contexto histórico
- Aprendizado contínuo

---

## ✅ VALIDAÇÃO

### Teste 1 - Memória:
```
Usuário: "oi groot"
GROOT: "E aí! Tudo certo? 😄"

Usuário: "meu nome é gabriel"
GROOT: "Prazer, Gabriel! 👋"

Usuário: "qual meu nome?"
GROOT: "Seu nome é Gabriel!"
```

### Teste 2 - Perfil:
- Verifique em user_profiles
- Deve ter style: "casual"

### Teste 3 - Histórico:
- Verifique em conversations
- Deve ter todas as mensagens

---

## 🎉 BENEFÍCIOS

✅ **Memória Real** - GROOT lembra de tudo
✅ **Contexto** - Usa histórico nas respostas  
✅ **Perfil** - Aprende seu estilo
✅ **Persistência** - Dados salvos na nuvem
✅ **Escalabilidade** - Supabase cresce com você

**GROOT agora tem memória de verdade! 🧠**

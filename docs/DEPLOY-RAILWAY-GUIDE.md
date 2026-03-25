# 🚀 GUIA DEPLOY GIOM - RAILWAY

## 📋 PASSO A PASSO

### 1️⃣ CRIAR CONTA RAILWAY
- **Acesse**: https://railway.app
- **Clique**: "Sign up"
- **Use**: GitHub login
- **Plano**: Starter/Free trial conforme disponibilidade atual da plataforma

### 2️⃣ NOVO PROJETO
1. **Dashboard**: "New Project"
2. **Select**: "Deploy from GitHub repo"
3. **Choose**: seu repositório do monorepo
4. **Branch**: `main`

### 3️⃣ CONFIGURAR SERVIÇO
Use o backend oficial do monorepo:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node apps/api/src/server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 4️⃣ VARIÁVEIS DE AMBIENTE
No painel Railway → "Variables":

```env
NODE_ENV=production
PORT=3000
GROOT_MODE=quantum
EMBEDDINGS_PROVIDER=local
LOCAL_EMBEDDING_DIMENSIONS=768
GROQ_API_KEY=sua_chave
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_publica
SUPABASE_SERVICE_KEY=sua_service_key
JWT_SECRET=sua_chave_jwt
```

### 5️⃣ FONTE OFICIAL DO MONOREPO
- **Backend**: `apps/api/src/server.js`
- **Frontend estático**: `apps/web/public`
- **Desktop**: `apps/desktop/src/main.cjs`
- **Compatibilidade legada**: `api/`, `electron/main.js` e `ui/`

### 6️⃣ DEPLOY
- **Build**: Automático
- **Deploy**: Automático após push
- **Health check**: `/health`
- **URL**: gerada pelo Railway ao fim do deploy

---

## 🔗 LINKS DIRETOS

### 🚀 RAILWAY CADASTRO:
https://railway.app/signup

### 🚀 DASHBOARD:
https://railway.app/dashboard

### 🚀 GUIA OFICIAL:
https://docs.railway.app/deploy

---

## 📋 OBSERVAÇÕES IMPORTANTES

### ✅ O QUE MUDA NO MONOREPO
- O runtime oficial não usa mais `server-definitivo.js`
- O servidor principal agora sobe por `apps/api/src/server.js`
- A web oficial vive em `apps/web/public`

### ✅ QUANDO USAR
- Boa alternativa ao Render para hospedar a API do GIOM
- Útil se você quiser logs e métricas mais detalhados

### ⚠️ ATENÇÃO
- Se o Supabase já está em `768`, mantenha `LOCAL_EMBEDDING_DIMENSIONS=768` também no Railway
- Se o frontend for servido separadamente, aponte as chamadas da UI para a URL pública da API

---

## 🎉 RESULTADO ESPERADO

**GIOM online no Railway usando a estrutura oficial do monorepo**

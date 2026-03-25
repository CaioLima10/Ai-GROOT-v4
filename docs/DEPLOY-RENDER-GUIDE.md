# 🚀 GUIA DEPLOY GIOM - RENDER (100% GRATUITO)

## 📋 PASSO A PASSO COMPLETO

### 1️⃣ CRIAR CONTA RENDER
- **Acesse**: https://render.com
- **Clique**: "Sign Up"
- **Use**: GitHub login (recomendado)
- **Plano**: Free (já selecionado)

### 2️⃣ CONECTAR REPOSITÓRIO
1. **Dashboard**: "New" → "Web Service"
2. **Connect**: GitHub repository
3. **Select**: `gabeglds2-web/Ai-GROOT` (seu repositório)
4. **Branch**: `main` (ou `master`)

### 3️⃣ CONFIGURAR SERVIÇO
```yaml
# Render.yaml (já criado no projeto)
services:
  - type: web
    name: giom-ai
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm run start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: GROOT_MODE
        value: quantum
      - key: EMBEDDINGS_PROVIDER
        value: local
      - key: LOCAL_EMBEDDING_DIMENSIONS
        value: 768
      - key: GROQ_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: JWT_SECRET
        sync: false
```

### 4️⃣ CONFIGURAR VARIÁVEIS DE AMBIENTE
No painel do Render → "Environment":
```env
NODE_ENV=production
PORT=10000
GROOT_MODE=quantum
EMBEDDINGS_PROVIDER=local
LOCAL_EMBEDDING_DIMENSIONS=768
GROQ_API_KEY=sua_groq_api_key_aqui
SUPABASE_URL=https://nyvljbcrfletvxqwprgb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_DK_FRXaqyui-v6zFgXaJoQ_11wQxJpp
JWT_SECRET=groot-jwt-secret-key-2024
```

### 5️⃣ DEPLOY AUTOMÁTICO
- **Build**: Automático ao conectar
- **Deploy**: Automático após push
- **URL**: `https://giom-ai.onrender.com`

### 6️⃣ VERIFICAR DEPLOY
- **Acesse**: URL gerada pelo Render
- **Teste**: Conversa com GIOM
- **Logs**: Verificar se está funcionando

---

## 🎯 VANTAGENS DO RENDER

### ✅ GRÁTIO:
- **750 horas/mês** de servidor
- **1GB RAM** suficiente
- **PostgreSQL** gratuito
- **SSL** automático
- **Custom domain** (com upgrade)

### ✅ FÁCIL:
- **GitHub integration** automática
- **Zero config** deployment
- **Auto-restart** em erros
- **Logs** em tempo real

---

## 🔗 LINKS DIRETOS

### 🚀 RENDER CADASTRO:
https://render.com/register

### 🚀 DASHBOARD:
https://dashboard.render.com

### 🚀 GUIA OFICIAL:
https://render.com/docs/deploy-nodejs

---

## 📋 O QUE ACONTECE DEPOIS DO DEPLOY

### ✅ AUTOMÁTICO:
- Build do código
- Instalação de dependências
- Início do servidor
- Health checks

### ✅ URL FINAL:
`https://giom-ai.onrender.com` (ou similar)

### ✅ FEATURES:
- Chat interface funcionando
- Memória persistente
- Embeddings avançados
- Analytics em tempo real

### ✅ FONTE OFICIAL NO MONOREPO:
- Backend: `apps/api/src/server.js`
- Frontend estático: `apps/web/public`

---

## 🎯 PRÓXIMO PASSO

### 📋 HOJE:
1. **Criar conta Render**
2. **Conectar repositório**
3. **Configurar variáveis**
4. **Fazer primeiro deploy**

### 📋 DEPOIS:
1. **Testar online**
2. **Compartilhar URL**
3. **Monitore analytics**

---

## 🎉 RESULTADO ESPERADO

**GIOM online para o mundo usar!**

🌐 `https://giom-ai.onrender.com`

🚀 IA de desenvolvedor completa e funcional!

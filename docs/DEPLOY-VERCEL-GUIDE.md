# 🚀 GUIA DEPLOY GROOT - VERCEL (FRONTEND FOCADO)

## 📋 PASSO A PASSO

### 1️⃣ CRIAR CONTA VERCEL
- **Acesse**: https://vercel.com
- **Clique**: "Sign Up"
- **Use**: GitHub login
- **Plano**: Hobby (grátis)

### 2️⃣ IMPORTAR PROJETO
1. **Dashboard**: "Add New" → "Project"
2. **Import**: `Ai-GROOT` repository
3. **Framework**: "Other" (Node.js)
4. **Root Directory**: `.`

### 3️⃣ CONFIGURAÇÃO
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server-definitivo.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server-definitivo.js"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "PORT": "3000"
  }
}
```

### 4️⃣ VARIÁVEIS DE AMBIENTE
No painel Vercel → "Settings" → "Environment Variables":
```env
GROQ_API_KEY=sua_groq_api_key_aqui
SUPABASE_URL=https://nyvljbcrfletvxqwprgb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_DK_FRXaqyui-v6zFgXaJoQ_11wQxJpp
JWT_SECRET=groot-jwt-secret-key-2024
```

### 5️⃣ DEPLOY
- **Build**: Automático
- **Deploy**: Automático
- **URL**: `https://groot-ai.vercel.app`

---

## 🔗 LINKS DIRETOS

### 🚀 VERCEL CADASTRO:
https://vercel.com/signup

### 🚀 DASHBOARD:
https://vercel.com/dashboard

### 🚀 GUIA OFICIAL:
https://vercel.com/docs/concepts/projects

---

## 📋 VANTAGENS DO VERCEL

### ✅ GRÁTIO:
- **100GB bandwidth/mês**
- **Serverless functions**
- **Edge deployment**
- **SSL** automático
- **Custom domains**

### ✅ PERFORMANCE:
- **Global CDN**
- **Edge locations**
- **Instant deployments**
- **Preview branches**

---

## 📋 LIMITAÇÕES

### ⚠️ SERVERLESS:
- **Não roda servidor 24/7**
- **Timeout**: 10 segundos (free)
- **Cold starts**: Primeira requisição lenta
- **Estado**: Sem persistência local

---

## 🎯 QUANDO USAR VERCEL

### ✅ IDEAL PARA:
- **Frontend focado**
- **API serverless**
- **Baixo tráfego**
- **Performance crítica**

### ❌ NÃO IDEAL PARA:
- **Servidor 24/7**
- **Long-running processes**
- **Estado local**
- **WebSocket connections**

---

## 🎉 RESULTADO ESPERADO

**GROOT no Vercel (serverless)!**

🌐 `https://groot-ai.vercel.app`

🚀 IA funcional com limitações serverless

---

## 💡 RECOMENDAÇÃO

### 🥇 **RENDER** (Melhor para GROOT)
- Servidor 24/7
- PostgreSQL integrado
- Fácil configuração

### 🥈 **RAILWAY** (Alternativa)
- Interface profissional
- Logs detalhados

### 🥉 **VERCEL** (Frontend focado)
- Performance máxima
- Serverless limitations

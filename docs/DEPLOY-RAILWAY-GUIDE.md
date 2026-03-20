# 🚀 GUIA DEPLOY GROOT - RAILWAY (ALTERNATIVA GRÁTITA)

## 📋 PASSO A PASSO

### 1️⃣ CRIAR CONTA RAILWAY
- **Acesse**: https://railway.app
- **Clique**: "Sign up"
- **Use**: GitHub login
- **Plano**: Free ($5 créditos/mês)

### 2️⃣ NOVO PROJETO
1. **Dashboard**: "New Project"
2. **Select**: "Deploy from GitHub repo"
3. **Choose**: `Ai-GROOT` repository
4. **Branch**: `main` ou `master`

### 3️⃣ CONFIGURAR SERVIÇO
```yaml
# railway.toml (já criado)
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server-definitivo.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "groot-ai"
source = "."
```

### 4️⃣ VARIÁVEIS DE AMBIENTE
No painel Railway → "Variables":
```env
NODE_ENV=production
PORT=3000
GROQ_API_KEY=gsk_SUA_CHAVE_AQUI
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE_AQUI
JWT_SECRET=groot-jwt-secret-key-2024
```

### 5️⃣ DEPLOY
- **Build**: Automático
- **Deploy**: Automático após configuração
- **URL**: `https://groot-ai-production.up.railway.app`

---

## 🔗 LINKS DIRETOS

### 🚀 RAILWAY CADASTRO:
https://railway.app/signup

### 🚀 DASHBOARD:
https://railway.app/dashboard

### 🚀 GUIA OFICIAL:
https://docs.railway.app/deploy

---

## 📋 VANTAGENS DO RAILWAY

### ✅ GRÁTIO:
- **500 horas/mês**
- **$5 créditos/mês**
- **PostgreSQL** gratuito
- **SSL** automático
- **Custom domains**

### ✅ DESENVOLVEDOR:
- **Interface limpa**
- **Logs detalhados**
- **Metrics** em tempo real
- **One-click deploy**

---

## 🎯 VANTAGENS VS RENDER

| Característica | Render | Railway |
|---------------|---------|---------|
| Horas/mês | 750h | 500h |
| RAM | 1GB | 512MB |
| PostgreSQL | ✅ | ✅ |
| Custom Domain | 💰 | ✅ |
| Interface | Simples | Profissional |
| Logs | Básicos | Detalhados |

---

## 🎉 RESULTADO ESPERADO

**GROOT online no Railway!**

🌐 `https://groot-ai-production.up.railway.app`

🚀 IA funcional e pronta para uso!

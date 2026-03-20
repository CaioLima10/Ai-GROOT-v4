# 🚀 GUIA DEPLOY GRATUITO - GROOT

## 📋 OPÇÕES 100% GRATUITAS

### 🥇 RENDER (RECOMENDADO)
- **URL**: https://render.com
- **Plano**: Free Tier
- **Limites**: 
  - 750 horas/mês (suficiente)
  - 1GB RAM
  - Banco PostgreSQL gratuito
- **Deploy**: Git integration

### 🥈 RAILWAY
- **URL**: https://railway.app
- **Plano**: Free Tier
- **Limites**:
  - 500 horas/mês
  - 512MB RAM
  - $5 créditos/mês

### 🥉 VERCEL
- **URL**: https://vercel.com
- **Plano**: Free Tier
- **Limites**:
  - Serverless functions
  - 100GB bandwidth
  - Edge deployment

---

## 🚀 DEPLOY PASSO A PASSO (RENDER)

### 1️⃣ PREPARAR PROJETO
```bash
# Criar arquivo render.yaml
echo "
services:
  - type: web
    name: groot-ai
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node server-definitivo.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
" > render.yaml
```

### 2️⃣ CONFIGURAR VARIÁVEIS
No painel do Render:
- **Environment Variables**
- Adicionar todas as variáveis do .env:
  - `GROQ_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `JWT_SECRET`

### 3️⃣ DEPLOY
1. Conectar repositório GitHub
2. Automatic build e deploy
3. URL: `https://groot-ai.onrender.com`

---

## 🌐 Interface Web (SITE)

### 📋 O QUE É INTERFACE WEB?
Frontend para interagir com GROOT:
- **Chat interface** (como ChatGPT)
- **Login/cadastro**
- **Histórico de conversas**
- **Dashboard de analytics**

### 🎯 OPÇÕES GRÁTITAS:

#### **VITE + TAILWIND (RECOMENDADO)**
```bash
# Criar frontend
npm create vite@latest groot-frontend -- --template react
cd groot-frontend
npm install -D tailwindcss
npx tailwindcss init -p
```

#### **BOOTSTRAP (SIMPLES)**
```bash
# HTML simples com Bootstrap
# Já tem ui/index.html - pode usar como base
```

#### **STREAMLIT (PYTHON - RÁPIDO)**
```python
import streamlit as st
import requests

st.title("🌳 GROOT AI")
user_input = st.text_input("Pergunte ao GROOT:")

if user_input:
    response = requests.post("https://seu-groot-url.com/ask", 
                           json={"prompt": user_input})
    st.write(response.json()["response"])
```

---

## 🎯 RECOMENDAÇÃO FINAL

### 📋 MÍNIMO PARA FUNCIONAR:
1. **Deploy**: Render (grátis)
2. **Frontend**: HTML simples (já existe)
3. **Backend**: Node.js atual

### 📋 COMPLETO PROFISSIONAL:
1. **Deploy**: Render + domínio custom
2. **Frontend**: React + Tailwind
3. **Backend**: Node.js + Supabase
4. **Analytics**: Dashboard completo

---

## 🚨 O QUE PRECISA FAZER AGORA

### 🔴 IMEDIATO (HOJE):
1. **Testar embeddings gratuitos**
2. **Criar GitHub token** (opcional)
3. **Preparar para deploy**

### 🟡 CURTO PRAZO (AMANHÃ):
1. **Criar conta Render**
2. **Fazer primeiro deploy**
3. **Testar online**

### 🟢 MÉDIO PRAZO (ESTA SEMANA):
1. **Criar frontend bonito**
2. **Adicionar analytics**
3. **Promover GROOT**

---

## 💡 DICA PROFISSIONAL

**Comece simples:** Deploy com HTML básico
**Evolua depois:** Adicione React + analytics

**Importante:** GROOT já está 100% funcional!
Só precisa estar online para o mundo usar! 🚀

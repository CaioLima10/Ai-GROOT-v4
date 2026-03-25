# 🚀 GUIA DEPLOY GIOM - VERCEL (WEB ESTÁTICA)

## 📋 QUANDO USAR

Use Vercel para publicar a interface web oficial do monorepo em `apps/web/public`.

Para a API principal do GIOM, prefira:
- **Render**
- **Railway**
- **Zeabur**

O backend oficial continua em `apps/api/src/server.js`.

## 📋 PASSO A PASSO

### 1️⃣ CRIAR CONTA VERCEL
- **Acesse**: https://vercel.com
- **Clique**: "Sign Up"
- **Use**: GitHub login
- **Plano**: Hobby

### 2️⃣ IMPORTAR O PROJETO
1. **Dashboard**: "Add New" → "Project"
2. **Import**: seu repositório do monorepo
3. **Framework**: "Other"
4. **Root Directory**: `apps/web/public`

### 3️⃣ CONFIGURAÇÃO
Para o uso estático, não existe mais dependência de `server-definitivo.js`.

O ponto oficial da web é:

```text
apps/web/public
```

Arquivos principais:
- `index.html`
- `admin.html`
- `chat.js`
- `style.css`

### 4️⃣ VARIÁVEIS DE AMBIENTE
Se a interface precisar conversar com uma API remota, configure apenas a URL pública do backend que estiver hospedado no Render, Railway ou Zeabur.

Exemplo:

```env
API_BASE_URL=https://sua-api-publica.com
```

### 5️⃣ DEPLOY
- **Build**: imediato para conteúdo estático
- **Deploy**: automático após push
- **URL**: gerada pelo Vercel

---

## 🔗 LINKS DIRETOS

### 🚀 VERCEL CADASTRO:
https://vercel.com/signup

### 🚀 DASHBOARD:
https://vercel.com/dashboard

### 🚀 GUIA OFICIAL:
https://vercel.com/docs

---

## 📋 LIMITAÇÕES

### ⚠️ IMPORTANTE
- Vercel não é o caminho principal para rodar esta API Node/streaming como servidor persistente
- Para streaming, memória remota e runtime contínuo, use o backend oficial em outra plataforma
- O Vercel aqui entra como hospedagem da camada web

---

## 🎯 RECOMENDAÇÃO

### 🥇 MELHOR COMBINAÇÃO
- **Frontend**: Vercel com `apps/web/public`
- **Backend**: Render ou Railway com `apps/api/src/server.js`

### ✅ FONTE OFICIAL DO MONOREPO
- Web: `apps/web/public`
- API: `apps/api/src/server.js`
- Desktop: `apps/desktop/src/main.cjs`

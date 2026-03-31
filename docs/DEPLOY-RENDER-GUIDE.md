# GUIA DEPLOY GIOM - RENDER

## Objetivo

Hospedar a API oficial do GIOM no Render e manter o frontend Next.js separado.

## Servico oficial

```yaml
services:
  - type: web
    name: giom-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node apps/api/src/server.js
```

## Variaveis de ambiente

```env
NODE_ENV=production
PORT=10000
GROQ_API_KEY=sua_chave
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_publica
JWT_SECRET=sua_chave_jwt
```

## Fluxo recomendado

- Backend: Render com `apps/api/src/server.js`
- Frontend: Vercel com `apps/web-next`

## Fonte oficial do monorepo

- Backend: `apps/api/src/server.js`
- Frontend: `apps/web-next`
- Desktop: `apps/desktop/src/main.cjs`

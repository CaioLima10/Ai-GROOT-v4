# GUIA DEPLOY GIOM - VERCEL

## Quando usar

Use o Vercel para publicar o frontend oficial em Next.js do monorepo:

- Frontend oficial: `apps/web-next`
- Backend oficial: `apps/api/src/server.js`

O backend continua melhor hospedado em Render, Railway ou Zeabur. No Vercel, o foco aqui e a camada web.

## Passo a passo

### 1. Importar o repositório

1. Acesse https://vercel.com
2. Clique em `Add New` -> `Project`
3. Importe este repositório
4. Mantenha o `Root Directory` na raiz do repositório
5. Framework: `Next.js`

### 2. Build e runtime

Este projeto ja possui [`vercel.json`](/c:/Users/GabeG/Desktop/Ai-GROOT/vercel.json) configurado para o frontend novo.

Config atual:

- `buildCommand`: `npm ci && npm run web-next:build`
- `outputDirectory`: `apps/web-next/.next`
- rewrite de `/backend/:path*` para o backend publico

### 3. Variaveis de ambiente

Se o backend estiver fora do Vercel, configure:

```env
NEXT_PUBLIC_BACKEND_PROXY_TARGET=https://seu-backend-publico.com
```

### 4. Deploy

- Build: automatico apos push
- URL: gerada pelo Vercel
- Frontend servido a partir de `apps/web-next`

## Fonte oficial do monorepo

- Web: `apps/web-next`
- API: `apps/api/src/server.js`
- Desktop: `apps/desktop/src/main.cjs`

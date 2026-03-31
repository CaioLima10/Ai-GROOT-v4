# GUIA DEPLOY GIOM - RAILWAY

## Objetivo

Usar o Railway para subir o backend oficial do GIOM e manter o frontend novo separado.

## Passo a passo

### 1. Novo projeto

1. Acesse https://railway.app
2. Clique em `New Project`
3. Selecione o repositório
4. Branch recomendada: `main`

### 2. Start command

Use o runtime oficial:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node apps/api/src/server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 3. Variaveis de ambiente

```env
NODE_ENV=production
PORT=3000
GROQ_API_KEY=sua_chave
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_publica
SUPABASE_SERVICE_KEY=sua_service_key
JWT_SECRET=sua_chave_jwt
```

## Fonte oficial do monorepo

- Backend: `apps/api/src/server.js`
- Frontend: `apps/web-next`
- Desktop: `apps/desktop/src/main.cjs`

## Observacoes

- O frontend legado nao faz mais parte do fluxo oficial.
- Para publicar a web, use Vercel com o frontend em `apps/web-next`.
- O Railway fica como host recomendado para a API quando voce quiser logs e operacao simples.

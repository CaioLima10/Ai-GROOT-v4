# Web Next

Frontend oficial do Ai-GROOT com Next.js + React + Tailwind.

## Getting Started

No monorepo, use na raiz:

```bash
npm run dev
```

Isso sobe:

- Backend: `http://localhost:3001`
- Frontend Next: `http://localhost:3003`

Abra `http://localhost:3003`.

O frontend usa proxy de desenvolvimento em `/backend/*` apontando para `http://localhost:3001`.

Para rodar somente o frontend:

```bash
npm run dev:web
```

Para build de produção do frontend:

```bash
npm run web-next:build
npm run web-next:start
```

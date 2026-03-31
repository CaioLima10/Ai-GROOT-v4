# Apps

Aplicações executáveis do monorepo.

Estado atual:

- `apps/api`: ponto de entrada oficial do backend (`apps/api/src/server.js`)
- `apps/web-next`: frontend oficial com Next.js/React/Tailwind (`apps/web-next`)
- `apps/desktop`: shell Electron oficial do monorepo

Compatibilidade preservada:

- `api/` agora aponta para implementacoes em `apps/api/src`
- `electron/main.js` agora aponta para `apps/desktop/src/main.cjs`

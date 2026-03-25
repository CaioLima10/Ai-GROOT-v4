# Apps

Aplicações executáveis do monorepo.

Estado atual:
- `apps/api`: ponto de entrada oficial do backend (`apps/api/src/server.js`)
- `apps/web`: fonte oficial da interface web (`apps/web/public`)
- `apps/desktop`: shell Electron oficial do monorepo
- `ui/`: espelho legado opcional para compatibilidade, nao e mais fonte primaria

Compatibilidade preservada:
- `api/` agora aponta para implementacoes em `apps/api/src`
- `electron/main.js` agora aponta para `apps/desktop/src/main.cjs`
- `ui/` pode ser atualizado manualmente por `npm run web:sync`

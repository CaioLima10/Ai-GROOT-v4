# Monorepo Roadmap

## Estrutura oficial

```text
apps/
  api/
  web-next/
  desktop/
packages/
  ai-core/
  shared-config/
```

## Status atual

Concluido:

1. backend oficial em `apps/api/src`
2. frontend oficial em `apps/web-next`
3. desktop oficial em `apps/desktop`
4. configuracoes compartilhadas em `packages/shared-config`
5. servicos centrais de IA em `packages/ai-core`
6. workspace npm ativo na raiz

Compatibilidade mantida:

- `api/`, `core/` e `config/` ainda existem como ponte para partes do runtime
- o frontend legado saiu do fluxo oficial e deve permanecer apenas fora do caminho principal

## Proximos passos

1. quebrar `apps/web-next/src/app/page.tsx` em componentes menores
2. consolidar contratos compartilhados entre frontend e backend
3. manter QA, stress e auditoria apontando apenas para `apps/web-next`
4. reduzir entrypoints legados de servidor na raiz

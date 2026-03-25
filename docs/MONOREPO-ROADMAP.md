# Monorepo Roadmap

## Estrutura alvo

```text
apps/
  web/
  api/
  desktop/
  vscode-extension/
packages/
  ai-core/
  shared-ui/
  shared-config/
  shared-types/
```

## Status atual

Concluido:
1. backend oficial em `apps/api/src`;
2. web oficial em `apps/web/public`;
3. desktop oficial em `apps/desktop`;
4. configuracoes compartilhadas em `packages/shared-config`;
5. memoria, embeddings, RAG e prompt context em `packages/ai-core`;
6. workspace npm ativo na raiz.

Compatibilidade mantida:
- `api/`, `core/` e `config/` seguem como ponte para nao quebrar runtime legado.
- `ui/` segue apenas como espelho legado opcional.

## Ordem segura

1. congelar entrypoint oficial do backend;
2. extrair configs e modelos compartilhados;
3. mover UI e API para `apps/`;
4. criar pacotes reutilizaveis;
5. ligar workspace e pipeline.

## Proxima camada de maturidade

O monorepo estrutural esta consolidado. Os proximos passos deixam de ser migracao de layout e passam a ser evolucao de plataforma:

1. extrair `shared-types` para contrato entre frontend e backend;
2. introduzir build pipeline real para `apps/web` se a interface sair do modo estatico;
3. mover mais servicos de `core/enterprise` para `packages/ai-core`.

## Observacao

Nao vale mover tudo de uma vez sem consolidar primeiro o servidor principal e o contrato de API.

# Packages

Bibliotecas compartilhadas do monorepo.

Estado atual:
- `packages/shared-config`: perfis, módulos, branding, categorias e embeddings
- `packages/ai-core`: prompt builder, prompt context, memória, embeddings e RAG

Próximas bibliotecas:
- `packages/shared-ui`: componentes, estilos e utilitários de interface
- `packages/shared-types`: contratos entre frontend e backend

A migração segue incremental, mantendo compatibilidade com `core/`, `config/` e os scripts legados enquanto o runtime principal é deslocado para `apps/` e `packages/`.

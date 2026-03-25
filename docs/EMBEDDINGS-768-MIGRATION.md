# Migracao de Embeddings para 768

## Quando mudar

Mude para `768` somente quando voce for migrar app e banco juntos.

Se o app gerar embedding `768` e o pgvector ainda estiver em `384`, o RAG vai falhar em inserts e buscas.

## Ordem segura

1. Execute [database/pgvector-dimension-768.sql](/c:/Users/GabeG/Desktop/Ai-GROOT/database/pgvector-dimension-768.sql) no Supabase.
2. No ambiente do app, defina:
   `EMBEDDINGS_PROVIDER=local`
   `LOCAL_EMBEDDING_DIMENSIONS=768`
3. Faça deploy.
4. Execute `npm run knowledge:rebuild` para reconstruir embeddings remotos existentes.
5. Execute `npm run knowledge:ingest` para sincronizar a base do repositorio sem duplicar conhecimento.

## Render

Se o deploy no Render ainda estiver em `384`, nao mude so o Render.

Primeiro migre o banco vetorial no Supabase. Depois ajuste as variaveis do Render para `768` e redeploy.

Valores oficiais apos a migracao:
- `EMBEDDINGS_PROVIDER=local`
- `LOCAL_EMBEDDING_DIMENSIONS=768`

## Observacao importante

O projeto em deploy usa Supabase para memoria/RAG. Entao a parte critica da dimensao vetorial vive no schema SQL do Supabase, nao no Render em si.

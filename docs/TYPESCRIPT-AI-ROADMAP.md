# TypeScript AI Roadmap

## O que o projeto ja tem

- `apps/web-next` ja esta em `Next.js + React + TypeScript`.
- O backend oficial esta em `apps/api/src/enterpriseServer.js`.
- O nucleo que mais afeta a IA esta em `packages/ai-core/src`.
- A configuracao compartilhada de perfis, capacidades, modulos e packs esta em `packages/shared-config/src`.
- Ja existe avaliacao de conversa, memoria, RAG, clima, esportes, documentos e streaming.

## O que ainda falta para TypeScript ajudar a IA de verdade

- Contrato compartilhado entre frontend, backend e renderizacao de cards estruturados.
- Tipagem das entradas criticas que viram prompt: `question`, `context`, `weatherLocation`, `activeModules`, `assistantProfile`.
- Tipagem das saidas estruturadas da IA: `code`, `prompt`, `table`, `timeline`, `data`, `document`.
- Typecheck incremental no backend e nos modulos de IA sem reescrever o runtime inteiro.
- Testes de contrato para evitar regressao silenciosa quando o frontend passa a esperar um shape e o backend devolve outro.

## Onde TypeScript traz mais ganho para a IA

1. Contratos de contexto.
   O prompt fica melhor quando o contexto chega limpo e previsivel ao backend.

2. Saida estruturada.
   O frontend de voces renderiza clima, fixtures, tabelas e prompts a partir de JSON. Tipar isso evita cards quebrados e parsing heuristico demais.

3. Avaliacao e observabilidade.
   Tipar scores, dimensoes e metadata evita dashboards e benchs inconsistentes.

4. Integracoes mutaveis.
   Clima, esportes, busca e OCR recebem payloads irregulares. Tipos e normalizacao reduzem erro operacional.

## Fase 1 aplicada nesta rodada

- Contrato compartilhado criado em `packages/shared-config/src/runtimeContracts.js`.
- Tipos compartilhados adicionados em `packages/shared-config/src/runtimeContracts.d.ts`.
- `web-next` passou a consumir o contrato compartilhado para sanitizacao de contexto e tipos de mensagem.
- Backend passou a sanitizar o `context` do `/ask` e `/ask/stream` a partir do mesmo contrato.
- Testes de contrato adicionados em `tests/runtime-contracts.test.js`.

## Fase 2 aplicada nesta rodada

- Contratos do nucleo de IA adicionados em `packages/ai-core/src/aiContracts.d.ts`.
- `buildAssistantPrompt` agora tem contrato tipado para contexto runtime, memoria, RAG e payload de prompt.
- `buildAssistantPromptContext` agora expõe contrato tipado para o pacote de prompt montado antes da chamada do modelo.
- `evaluateConversationTurn`, `summarizeConversationEvaluation` e `runConversationBenchmark` agora possuem contratos tipados para score, dimensoes, detalhes e turnos de benchmark.
- Typecheck incremental do nucleo de IA adicionado em `tsconfig.ai-core.json`.
- Testes de contrato do nucleo adicionados em `tests/ai-core-contracts.test.js`.

## Proximas fases recomendadas

### Fase 3

- Tipar `buildRuntimeConversationContext`.
- Tipar payloads de clima, busca web, OCR e agenda esportiva.
- Aplicar `@ts-check` incremental nos arquivos de runtime menores primeiro, como `apps/api/src/liveResearch.js` e `apps/api/src/runtimeClock.js`, antes de endurecer o `enterpriseServer.js` inteiro.
- Migrar modulos pequenos e estaveis de `.js` para `.ts` primeiro:
  - `packages/shared-config/src/researchCapabilities.js`
  - `apps/api/src/runtimeClock.js`
  - `apps/api/src/liveResearch.js`
  - `packages/ai-core/src/conversationEvaluator.js`

### Fase 4

- Migrar o backend principal por fronteiras, nao por reescrita total:
  - contratos
  - helpers puros
  - providers
  - rotas criticas

## Regra pratica

TypeScript melhora mais a IA quando protege:

- o que entra no prompt
- o que sai como resposta estruturada
- o que mede qualidade

Ele melhora pouco quando usado so como reescrita cosmetica do servidor.

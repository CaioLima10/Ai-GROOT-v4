# GIOM Big Tech Gap Analysis

## Escopo

Este estudo compara a estrutura atual do GIOM com padroes publicos e oficiais expostos por OpenAI, Google Gemini e Groq.

Importante:

- Nao existe acesso ao codigo interno proprietario de ChatGPT, Gemini, Codex cloud ou stacks privadas dessas empresas.
- A comparacao aqui usa apenas codigo local do GIOM e documentacao publica oficial.

## O que o GIOM ja tem hoje

- Monorepo com separacao entre `apps/`, `packages/`, `backend/` e `core/`.
- Pipeline unificado para `/ask` e `/ask/stream`.
- Camada de compatibilidade com APIs no estilo OpenAI e Gemini:
  - `POST /v1/chat/completions`
  - `POST /v1/responses`
  - `POST /v1beta/models/:model:generateContent`
- Memoria de sessao + memoria semantica + ranking hibrido.
- Upload, OCR, geracao de imagem e geracao de documento.
- Avaliacao e self-healing em runtime.
- Roteamento por intencao e fallback operacional.

## Onde o GIOM ainda quebra

### P0. Porta, preview e proxy sem fonte unica de verdade

- O repositorio estava com documentacao e defaults divergentes entre `3000`, `3001`, `3003` e `3004`.
- Isso gera HTTP 500 do proxy do Next mesmo quando o problema real e backend offline ou porta errada.
- Esse e o principal ponto a tratar antes de qualquer salto de capacidade.

### P0. Servidor enterprise grande demais

- `apps/api/src/enterpriseServer.js` concentra boot, wiring, deps, providers, memoria, routes e runtime policy num arquivo muito extenso.
- Big tech normalmente mantem composition root pequeno e registradores/coordenadores bem menores.
- O risco aqui e regressao por acoplamento acidental.

### P0. JS e TS duplicados no mesmo runtime

- Ha muitos pares `*.ts` e `*.js` lado a lado em `apps/api/src`.
- Isso aumenta risco de editar um arquivo e executar outro.
- Para estabilidade de produto, isso precisa convergir para um fluxo de build unico.

### P1. Falta observabilidade de nivel enterprise

- O GIOM ja mede bastante coisa, mas ainda falta stack padrao de traces, spans e correlacao request -> provider -> memory -> tools.
- Sem isso, bugs intermitentes parecem "500 aleatorio".

### P1. Falta camada formal de contratos de payload

- O runtime ja sanitiza e normaliza bem, mas ainda depende demais de objetos livres.
- Big tech tende a usar schemas versionados e validacao forte nas fronteiras.

## O que as grandes stacks publicas fazem

### OpenAI

- API unificada de resposta com estado conversacional e ferramentas no `Responses API`.
- Structured Outputs para garantir JSON valido por schema.
- Realtime API para voz e multimodal em baixa latencia.
- Evals como parte obrigatoria do ciclo de melhoria.
- Modelo especializado para coding agents (`GPT-5-Codex`) com contexto muito grande.

### Google Gemini

- Live API com sessao de longa duracao, tool use e credenciais efemeras.
- Grounding com Google Search.
- Context caching implicito e explicito para custo e latencia.
- Dialogo afetivo e adaptacao de tom em cenarios de voz.

### Groq

- Foco forte em latencia.
- Tool use com suporte a tool calling.
- Compound systems com interface unificada para tools externas.
- Batch API para cargas assincronas e avaliacoes em escala.

## O que falta para o GIOM parecer produto de IA de verdade

### 1. Runtime unificado de conversa

Criar uma camada canonica de conversa com:

- `conversationId`
- `turnId`
- `responseId`
- `traceId`
- estado resumido/compactado
- memoria curta, memoria semantica e resumo separado

Sem isso, dialogo longo vira custo alto, contexto instavel e regressao facil.

### 2. Voz real de produto

Prioridade ultra alta se a meta inclui fala, diccao e dialogo por horas:

- entrada de audio por streaming
- transcricao incremental
- sessao de voz full-duplex
- controle de latencia
- resposta por TTS
- turn detection / VAD

Endpoints recomendados:

- `POST /v1/audio/transcriptions`
- `POST /v1/audio/speech`
- `POST /v1/realtime/sessions`
- `WS /v1/realtime`

### 3. Ferramentas e grounding melhores

O GIOM ja tem pesquisa, clima, esportes, documentos e uploads. O proximo passo e padronizar isso como tool registry:

- `GET /v1/tools`
- `POST /v1/tools/:toolName/invoke`
- tracing por tool
- schema JSON por tool
- limites e timeouts por tool

### 4. Estrutura de evals continua

Adicionar pipeline de qualidade mais proximo de big tech:

- datasets de prompts canarios
- regressao por dominio
- scorecards por perfil
- release gate antes de subir preview/prod

Endpoints recomendados:

- `POST /v1/evals/run`
- `GET /v1/evals/:id`
- `GET /v1/reports/releases/:releaseId`

### 5. Observabilidade de verdade

Adicionar:

- OpenTelemetry
- traces por request
- span para memory retrieval, prompt build, provider call, tool call e self-healing
- log estruturado com requestId/traceId

### 6. Contratos fortes

Adicionar validacao por schema nas fronteiras HTTP e internas:

- `zod` ou `valibot` para request/response
- schemas versionados para `/ask`, `/ask/stream`, `/upload`, `/generate/*`
- contratos compartilhados entre frontend e backend

### 7. Fila e execucao assincrona

Para ficar parecido com produtos grandes, nem tudo deve ser sincrono:

- batch jobs
- ingestao assincrona
- OCR pesado
- geracao de documento longa
- avaliacoes em lote

Frameworks recomendados:

- `bullmq` para filas
- Redis como backend de job

## Frameworks que valem a pena

Nao precisa encher o projeto de framework so para "parecer big tech". Vale adicionar onde resolve dor real:

- `zod`: validacao forte de contratos
- `pino`: logs estruturados
- `@opentelemetry/sdk-node`: traces e spans
- `bullmq`: jobs assincronos
- `ioredis`: cliente Redis mais robusto

## Roadmap recomendado

### Semana 1

- Unificar portas, preview e proxy.
- Reduzir 500 generico por erro de infraestrutura.
- Criar script unico de preview da stack.
- Atualizar documentacao canonica.

### Semana 2

- Extrair composition root do `enterpriseServer`.
- Padronizar contratos HTTP com schema.
- Criar tracing por request.

### Semana 3

- Formalizar tool registry.
- Adicionar endpoints de voz e sessao realtime.
- Criar eval suite de regressao obrigatoria.

### Semana 4

- Implementar compaction/summarization de conversa longa.
- Introduzir filas para OCR, documentos e tarefas pesadas.
- Fechar release gate automatica.

## Fontes oficiais usadas

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/retrieve
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Realtime API: https://platform.openai.com/docs/guides/realtime
- OpenAI Evals: https://platform.openai.com/docs/guides/evals
- OpenAI GPT-5-Codex: https://platform.openai.com/docs/models/gpt-5-codex/
- Gemini Live API: https://ai.google.dev/gemini-api/docs/live
- Gemini Grounding: https://ai.google.dev/gemini-api/docs/grounding
- Gemini Context Caching: https://ai.google.dev/gemini-api/docs/caching
- Groq Tool Use: https://console.groq.com/docs/tool-use
- Groq Batch API: https://console.groq.com/docs/batch
- Groq Compound: https://console.groq.com/docs/compound/systems/compound

# AI Implementation Roadmap

## Objetivo

Transformar o GIOM em uma IA de produto real, capaz de manter contexto longo, conversar por horas, usar voz, tools, documentos e memoria de forma consistente, com stack gratuita ou self-hosted sempre que possivel.

## Estado atual

O GIOM ja possui:

- pipeline unificado para `/ask` e `/ask/stream`;
- compatibilidade com APIs no estilo OpenAI e Gemini;
- sessao realtime de voz com VAD;
- tool registry, jobs assincronos e tracing basico;
- contratos compartilhados com `zod` nas fronteiras mais criticas;
- OCR, upload, documentos, imagem e memoria operacional.

O que ainda separa o GIOM de uma "IA de verdade" nao e um unico modelo. E a combinacao de:

- memoria longa persistente;
- voz local server-side;
- orquestracao cognitiva;
- evals de conversa real;
- observabilidade forte;
- multimodal nativo ao raciocinio.

## Regra de priorizacao

Prioridade oficial do projeto daqui para frente:

1. Memoria longa de conversa e perfil do usuario.
2. Voz local de verdade no servidor.
3. Orquestracao cognitiva com tools, grounding e reflexao.
4. Evals de conversa real como gate de release.
5. Observabilidade de request, memory, tool e provider.
6. Multimodal robusto de ponta a ponta.

## Stack gratuita recomendada

### Modelos e raciocinio

- `Ollama` para modelos locais com tool calling e structured outputs.
- `Groq` ou `OpenRouter free` como fallback de nuvem quando o local nao der conta.

### Voz

- `whisper.cpp` ou `Vosk` para STT local/offline.
- `Piper1-GPL` para TTS local.
- VAD local no backend aproveitando o runtime de sessao que o GIOM ja tem.

### Observabilidade e evals

- `OpenTelemetry` para traces.
- `Langfuse` self-host para observabilidade e avaliacoes.
- `pino` para logs estruturados.

### Jobs e estado

- `BullMQ` + `Redis` quando houver necessidade real de fila distribuida.
- Enquanto isso, job manager local continua como fallback.

## Fase 0 - Base que nao quebra

### Objetivo

Manter o runtime estavel, evitar HTTP 500 opaco e garantir fronteiras fortes.

### Escopo

- unificacao de portas, preview e proxy;
- contratos fortes nas fronteiras HTTP;
- tracing basico e erro padronizado;
- tool registry e jobs assincronos.

### Status

- Parcialmente concluida.

### Criterios de aceite

- preview da stack sobe por um comando canonico;
- frontend para de mascarar backend offline como 500 generico;
- payloads criticos de voz e config entram e saem com schema validado.

## Fase 1 - Memoria longa e perfil do usuario

### Objetivo

Dar ao GIOM continuidade real de conversa, preferencias persistentes e compaction inteligente para dialogo longo.

### O que construir

- `conversationProfileStore` por usuario e por sessao;
- resumo progressivo por janela de conversa;
- memoria de preferencias:
  - tom;
  - idioma;
  - nivel tecnico;
  - estilo de resposta;
  - temas recorrentes;
- memoria de tarefas em andamento:
  - objetivo atual;
  - subtarefas;
  - decisoes tomadas;
  - pendencias;
- ranking entre:
  - memoria recente;
  - memoria semantica;
  - resumo;
  - perfil do usuario.

### Endpoints e contratos recomendados

- `GET /memory/profile/:userId`
- `POST /memory/profile/:userId`
- `POST /memory/sessions/:sessionId/compact`
- `GET /memory/sessions/:sessionId/summary`

### Entregaveis tecnicos

- modulo `memoryProfileRuntime`;
- modulo `conversationCompactionRuntime`;
- politicas de persistencia por sensibilidade;
- flags para desligar memoria de perfil por ambiente.

### Criterios de aceite

- conversa com 50+ turnos sem perder o objetivo principal;
- usuario pode retomar tema antigo e o GIOM lembrar resumo e preferencias;
- memoria sensivel nao entra em persistencia sem politica explicita.

### Esta e a proxima fase oficial a implementar

- Motivo:
  - e a fase com maior impacto em fala, compreensao, contexto, reflexao e conversa longa.

## Fase 2 - Voz local server-side

### Objetivo

Tirar a experiencia de voz da dependencia principal do navegador e tornar o backend capaz de operar voz com estabilidade.

### O que construir

- STT local no backend;
- TTS local no backend;
- VAD server-side;
- resposta incremental de voz por sessao realtime;
- fallback automatico:
  - server local;
  - browser-assisted;
  - texto puro.

### Stack recomendada

- `whisper.cpp` ou `Vosk` para transcricao;
- `Piper1-GPL` para sintese;
- reuso da sessao `/v1/realtime/sessions` ja existente.

### Endpoints recomendados

- manter:
  - `POST /v1/audio/transcriptions`
  - `POST /v1/audio/speech`
  - `POST /v1/realtime/sessions`
- adicionar:
  - `POST /v1/realtime/sessions/:sessionId/audio`
  - `GET /v1/realtime/sessions/:sessionId/audio/stream`
  - `GET /v1/voice/providers/status`

### Criterios de aceite

- voz continua funcionando quando o browser nao fornece STT/TTS bons;
- GIOM responde por audio com latencia previsivel;
- fallback nao derruba a conversa se o provider de voz falhar.

## Fase 3 - Orquestracao cognitiva

### Objetivo

Fazer o GIOM pensar melhor antes de responder, decidir quando usar tools e melhorar grounding e consistencia.

### O que construir

- planner leve por request;
- modo reflection/revise em perguntas ambiguuas ou de alto risco;
- policy de tools:
  - quando usar;
  - quando nao usar;
  - timeout;
  - grounding esperado;
- resposta com estrutura:
  - entendimento;
  - acao;
  - verificacao;
  - resposta final.

### Entregaveis tecnicos

- `orchestratorRuntime`;
- `toolPolicyRuntime`;
- `answerVerificationRuntime`;
- spans por etapa do raciocinio.

### Criterios de aceite

- menos respostas impulsivas;
- menos hallucination quando a resposta depende de dado externo;
- uso de tools mais coerente com a intencao do usuario.

## Fase 4 - Evals de conversa real

### Objetivo

Parar de medir apenas se o runtime responde e passar a medir se ele responde bem.

### O que construir

- packs de avaliacao para:
  - ambiguidade;
  - contexto longo;
  - sensibilidade;
  - discernimento politico;
  - tom humano;
  - autocorrecao;
  - memoria;
  - consistencia entre turnos;
- score por release;
- gate de release para nao subir regressao.

### Entregaveis tecnicos

- `eval pack` de dialogo longo;
- `eval pack` de voz;
- `eval pack` de interpretacao humana;
- scorecard por perfil do GIOM.

### Criterios de aceite

- release nova so sobe se mantiver ou melhorar score minimo;
- regressao de contexto ou tom aparece antes de ir para preview/prod.

## Fase 5 - Observabilidade forte

### Objetivo

Fazer qualquer erro, 500 ou degradacao de qualidade ficar rastreavel rapidamente.

### O que construir

- spans por:
  - request;
  - memoria;
  - tool;
  - provider;
  - compaction;
  - voz;
- log estruturado;
- painel para requestId/traceId;
- correlacao entre falha tecnica e queda de qualidade.

### Stack recomendada

- `OpenTelemetry`
- `pino`
- `Langfuse` self-host

### Criterios de aceite

- qualquer 500 relevante pode ser explicado por trace;
- requests lentos podem ser decompostos por etapa;
- falha de provider nao parece mais aleatoria.

## Fase 6 - Multimodal robusto

### Objetivo

Fazer documentos, imagem, OCR e audio entrarem no raciocinio como contexto nativo e nao como anexos isolados.

### O que construir

- pipeline multimodal unificado;
- contexto multimodal no mesmo contrato da conversa;
- extracao estruturada de documento;
- OCR + resumo + memoria;
- citacao de fonte por documento/upload.

### Criterios de aceite

- usuario envia audio, PDF, imagem e texto na mesma conversa e o GIOM responde com contexto integrado;
- documentos grandes nao derrubam fluxo sincrono;
- uploads geram blocos semanticos reutilizaveis.

## Fase 7 - Produto de IA confiavel

### Objetivo

Consolidar o GIOM como produto, nao apenas runtime tecnico.

### O que construir

- perfis por workspace;
- configuracao de memoria por usuario/time;
- politicas de privacidade e retencao;
- dashboard operacional;
- controle de capacidades por ambiente;
- release train com gates.

### Criterios de aceite

- o projeto passa a ter ciclo claro de:
  - desenvolvimento;
  - avaliacao;
  - deploy;
  - observacao;
  - correcao.

## Ordem de execucao recomendada

### Sprint 1

- memoria longa;
- perfil do usuario;
- resumo progressivo por conversa;
- criterios de persistencia e privacidade.

### Sprint 2

- STT/TTS local no servidor;
- fallback browser/server;
- estado realtime de voz integrado com memoria.

### Sprint 3

- planner;
- policy de tools;
- grounding e verificacao de resposta.

### Sprint 4

- evals de conversa real;
- gate de release;
- scorecard por perfil.

### Sprint 5

- OpenTelemetry;
- pino;
- correlacao de traces;
- dashboard tecnico.

### Sprint 6

- multimodal robusto;
- OCR/document/audio integrados ao contexto;
- pipelines assincronos onde necessario.

## O que nao fazer agora

- nao tentar treinar um modelo proprio do zero;
- nao trocar a arquitetura inteira de uma vez;
- nao encher o projeto de frameworks sem ganho operacional claro;
- nao misturar voz local, memoria longa e planner gigante no mesmo corte.

## Definicao de "IA de verdade" para o GIOM

Para o GIOM, "IA de verdade" significa:

- manter contexto longo;
- lembrar preferencias e tarefas;
- falar e ouvir com estabilidade;
- usar tools com criterio;
- interpretar situacoes ambiguas;
- responder com grounding;
- melhorar sem quebrar a cada release;
- ser observavel e debugavel.

Nao significa:

- fingir consciencia;
- depender de uma unica API paga;
- copiar a stack privada de big tech.

## Fontes oficiais de referencia

- Ollama tool calling: https://docs.ollama.com/capabilities/tool-calling
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
- whisper.cpp: https://github.com/ggml-org/whisper.cpp
- Vosk: https://alphacephei.com/vosk/
- Piper1-GPL: https://github.com/OHF-Voice/piper1-gpl
- OpenTelemetry JS: https://opentelemetry.io/docs/languages/js/
- Langfuse self-host: https://langfuse.com/self-hosting

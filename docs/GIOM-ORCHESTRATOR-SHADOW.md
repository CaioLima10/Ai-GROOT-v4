# GIOM Orchestrator Shadow Mode

## Objetivo

Integrar o novo orquestrador de forma segura, sem alterar o comportamento atual da resposta final.

## Como funciona

- O fluxo oficial continua usando o caminho atual de prompt/resposta.
- Em paralelo, o sistema gera um plano pelo orquestrador (shadow mode).
- O plano e usado apenas para observabilidade e evolucao, sem impactar a resposta entregue.

## Flag de ambiente

- `GIOM_ORCHESTRATOR_SHADOW=true` (padrao)
- `GIOM_ORCHESTRATOR_SHADOW=false` para desativar shadow mode.

## Onde foi integrado

- Endpoint `POST /ask`
- Endpoint `POST /ask/stream`

Arquivo principal:

- `apps/api/src/enterpriseServer.js`

## Dados observados em shadow

- `strategy`: decisao do orquestrador (RAG/memory/direct)
- `intentCategory`: categoria de intencao detectada
- `finalPromptLength`: tamanho do prompt final montado pelo orquestrador

## Garantias de nao regressao

- Nenhum caminho critico foi removido.
- Nenhuma resposta foi substituida pelo novo orquestrador.
- A instrumentacao e aditiva e pode ser desativada por variavel de ambiente.

## Proximo passo recomendado

- Rodar shadow por alguns dias e comparar metricas:
  - taxa de fallback
  - qualidade percebida
  - latencia
  - erro por provider

Quando houver estabilidade, habilitar rollout progressivo (A/B) antes de virar padrao.

---
name: "Orchestrated AI Resilience Smoke Test"
description: "Executar teste rapido do fluxo orquestrado para resiliencia operacional de IA: fallback de modelo, degradacao controlada e recuperacao"
argument-hint: "Descreva o incidente de resiliencia para iniciar o fluxo"
agent: "Engineering Workflow Orchestrator"
---
Inicie um fluxo ponta a ponta usando os handoffs configurados entre agentes para um incidente de resiliencia operacional de IA.

Contexto inicial do teste:
- Sistema afetado: camada de orquestracao LLM e roteamento de provedores
- Sintoma 1: indisponibilidade intermitente do provedor primario
- Sintoma 2: fallback acionando com atraso e elevando latencia p95
- Sintoma 3: degradacao de qualidade acima do limite acordado no failover
- Janela: ultimas 6 horas
- Impacto: aumento de timeout, queda de confiabilidade e piora na experiencia do usuario
- Mudanca recente: ajuste de politica de retries, timeouts e pesos de roteamento

Objetivo deste smoke test:
1. Validar que o handoff para Especialista Tecnologia aparece e funciona.
2. Validar que o handoff para Performance Observability Engineer aparece e funciona.
3. Validar que o handoff para Architecture Review Tech Lead aparece e funciona.
4. Encerrar com plano executivo cobrindo resiliencia, SLO, custo e recuperacao.

Formato de resposta esperado:
1. Etapa atual
2. Achado principal
3. Handoff seguinte recomendado

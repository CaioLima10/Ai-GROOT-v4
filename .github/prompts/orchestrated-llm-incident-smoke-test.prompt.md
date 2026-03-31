---
name: "Orchestrated LLM Incident Smoke Test"
description: "Executar teste rápido do fluxo orquestrado para incidente IA/LLM: alucinacao, regressao de qualidade e custo de token"
argument-hint: "Descreva o incidente de IA/LLM para iniciar o fluxo"
agent: "Engineering Workflow Orchestrator"
---
Inicie um fluxo ponta a ponta usando os handoffs configurados entre agentes para um incidente IA/LLM.

Contexto inicial do teste:
- Sistema afetado: pipeline de resposta IA com RAG
- Sintoma 1: aumento de alucinacao em respostas factuais
- Sintoma 2: regressao de qualidade apos mudanca de prompt e roteamento de modelos
- Sintoma 3: custo por resposta subiu 38% em 24h
- Janela: ultimas 24 horas
- Impacto: queda de satisfacao e aumento de tickets de correcao manual
- Mudanca recente: ajuste de strategy de retrieval e fallback de modelo

Objetivo deste smoke test:
1. Validar que o handoff para Especialista Tecnologia aparece e funciona.
2. Validar que o handoff para Performance Observability Engineer aparece e funciona.
3. Validar que o handoff para Architecture Review Tech Lead aparece e funciona.
4. Encerrar com plano executivo cobrindo qualidade, custo e confiabilidade.

Formato de resposta esperado:
1. Etapa atual
2. Achado principal
3. Handoff seguinte recomendado

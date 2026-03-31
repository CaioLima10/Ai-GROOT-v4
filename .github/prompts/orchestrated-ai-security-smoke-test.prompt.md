---
name: "Orchestrated AI Security Smoke Test"
description: "Executar teste rapido do fluxo orquestrado para incidente de seguranca em IA: prompt injection, data leakage e abuso de ferramentas"
argument-hint: "Descreva o incidente de seguranca de IA para iniciar o fluxo"
agent: "Engineering Workflow Orchestrator"
---
Inicie um fluxo ponta a ponta usando os handoffs configurados entre agentes para um incidente de seguranca em IA.

Contexto inicial do teste:
- Sistema afetado: assistente IA com RAG e chamadas de ferramentas
- Sintoma 1: tentativa de prompt injection para ignorar politicas internas
- Sintoma 2: suspeita de exposicao de dados sensiveis em respostas
- Sintoma 3: uso indevido de ferramentas com escopo alem do necessario
- Janela: ultimas 12 horas
- Impacto: risco de compliance, risco reputacional e aumento de severidade operacional
- Mudanca recente: novo conector de contexto e ajuste no roteamento de ferramentas

Objetivo deste smoke test:
1. Validar que o handoff para Especialista Tecnologia aparece e funciona.
2. Validar que o handoff para Performance Observability Engineer aparece e funciona.
3. Validar que o handoff para Architecture Review Tech Lead aparece e funciona.
4. Encerrar com plano executivo cobrindo mitigacao imediata, hardening e governanca.

Formato de resposta esperado:
1. Etapa atual
2. Achado principal
3. Handoff seguinte recomendado

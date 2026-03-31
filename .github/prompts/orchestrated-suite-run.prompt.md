---
name: "Orchestrated Suite Run"
description: "Rodar a suite completa de smoke tests orquestrados e validar handoffs fim a fim"
argument-hint: "Opcional: informe prioridade de cenario ou restricoes de tempo"
agent: "Engineering Workflow Orchestrator"
---
Execute a suite completa de validacao dos fluxos orquestrados usando os cenarios abaixo, um por vez.

Ordem recomendada:
1. Debug geral
2. Incidente IA/LLM
3. Seguranca de IA
4. Resiliencia operacional de IA

Prompts alvo da suite:
- /orchestrated-debug-smoke-test
- /orchestrated-llm-incident-smoke-test
- /orchestrated-ai-security-smoke-test
- /orchestrated-ai-resilience-smoke-test

Aplicar os 3 relatórios ao final da suite:
- /orchestrated-suite-report
- /orchestrated-suite-report-semaforo
- /orchestrated-suite-report-score

Checklist de aceitacao por cenario:
1. Handoff para Especialista Tecnologia aparece e funciona.
2. Handoff para Performance Observability Engineer aparece e funciona.
3. Handoff para Architecture Review Tech Lead aparece e funciona.
4. Fluxo encerra com recomendacao executiva objetiva.
5. Nao houve erro de frontmatter, carga de agente ou quebra de contexto.

Formato de resposta:
1. Cenario atual
2. Status dos 5 itens do checklist
3. Bloqueio encontrado (se houver)
4. Proximo cenario recomendado
5. Sumario final de conformidade da suite
6. Status da aplicacao dos 3 relatórios (3/3)

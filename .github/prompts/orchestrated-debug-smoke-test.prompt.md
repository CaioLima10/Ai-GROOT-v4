---
name: "Orchestrated Debug Smoke Test"
description: "Executar teste rápido do fluxo orquestrado Senior -> Performance -> Architecture com handoffs"
argument-hint: "Descreva o bug ou incidente para iniciar o fluxo"
agent: "Engineering Workflow Orchestrator"
---
Inicie um fluxo ponta a ponta usando os handoffs configurados entre agentes.

Contexto inicial do teste:
- Serviço afetado: API principal
- Sintoma: aumento de erro 500 e latência p95 acima de 2.5s em horário de pico
- Janela: últimas 2 horas
- Impacto: queda de conversão e timeout intermitente no frontend
- Mudança recente: deploy com ajustes em cache e validação de payload

Objetivo deste smoke test:
1. Validar que o handoff para Especialista Tecnologia aparece e funciona.
2. Validar que o handoff para Performance Observability Engineer aparece e funciona.
3. Validar que o handoff para Architecture Review Tech Lead aparece e funciona.
4. Encerrar com decisão executiva resumida e plano de ação.

Formato de resposta esperado:
1. Etapa atual
2. Achado principal
3. Handoff seguinte recomendado

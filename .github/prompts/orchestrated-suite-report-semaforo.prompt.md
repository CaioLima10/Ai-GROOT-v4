---
name: "Orchestrated Suite Report Semaforo"
description: "Gerar relatorio consolidado da suite com classificacao de risco por semaforo (Verde, Amarelo, Vermelho)"
argument-hint: "Informe resultados dos 4 cenarios, riscos e bloqueios"
agent: "Architecture Review Tech Lead"
---
Gere um relatorio tecnico-executivo unico em markdown, consolidando os resultados da suite orquestrada com semaforo de risco.

Entrada esperada:
- Resultado do cenario 1: orchestrated-debug-smoke-test
- Resultado do cenario 2: orchestrated-llm-incident-smoke-test
- Resultado do cenario 3: orchestrated-ai-security-smoke-test
- Resultado do cenario 4: orchestrated-ai-resilience-smoke-test
- Evidencias tecnicas, bloqueios e impactos

Regra de semaforo:
- Verde: risco baixo, sem bloqueio critico, pronto para seguir
- Amarelo: risco moderado, exige mitigacao planejada antes de escalar
- Vermelho: risco alto ou bloqueio critico, exige acao imediata e contingencia

Regras obrigatorias:
- Escrever em portugues claro e objetivo.
- Classificar cada cenario com semaforo e justificativa curta.
- Consolidar risco global da suite com semaforo final.
- Incluir plano de acao com owner, prazo e criterio de concluido.

Formato de saida obrigatorio:
1. Resumo executivo
2. Semaforo por cenario (4/4)
3. Achados criticos consolidados
4. Semaforo global da suite
5. Decisoes recomendadas
6. Plano de acao (owner, prazo, criterio de concluido)
7. Bloqueios e proximo checkpoint

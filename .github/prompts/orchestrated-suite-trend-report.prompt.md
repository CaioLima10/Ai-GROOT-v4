---
name: "Orchestrated Suite Trend Report"
description: "Analisar tendencia da suite entre sprints com score, semaforo e delta de risco"
argument-hint: "Informe historico de 2+ sprints com score global e score por cenario"
agent: "Architecture Review Tech Lead"
---
Gere um relatorio de tendencia da suite orquestrada, comparando sprints e destacando evolucao ou regressao.

Entrada esperada:
- Historico de pelo menos 2 sprints contendo:
  - Score global da suite
  - Score por cenario (debug, llm, seguranca, resiliencia)
  - Semaforo global
  - Principais bloqueios e mitigacoes aplicadas

Regras de analise:
- Calcular delta absoluto e percentual do score global entre sprint atual e anterior.
- Classificar tendencia: Melhorou, Estavel, Piorou.
- Identificar 3 causas provaveis da variacao.
- Sugerir 3 a 5 acoes priorizadas para elevar o score na proxima sprint.

Formato de saida obrigatorio:
1. Resumo executivo de tendencia
2. Comparativo sprint atual vs anterior
3. Delta por cenario
4. Riscos emergentes e recorrentes
5. Plano priorizado para proxima sprint

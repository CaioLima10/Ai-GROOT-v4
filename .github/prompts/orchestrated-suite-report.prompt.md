---
name: "Orchestrated Suite Report"
description: "Gerar relatorio unico em markdown com resultado consolidado da suite de smoke tests orquestrados"
argument-hint: "Informe os resultados dos 4 cenarios e bloqueios encontrados"
agent: "Architecture Review Tech Lead"
---
Gere um relatorio tecnico-executivo unico, em markdown, consolidando os resultados da suite orquestrada.

Entrada esperada:
- Resultado do cenario 1: orchestrated-debug-smoke-test
- Resultado do cenario 2: orchestrated-llm-incident-smoke-test
- Resultado do cenario 3: orchestrated-ai-security-smoke-test
- Resultado do cenario 4: orchestrated-ai-resilience-smoke-test
- Evidencias principais, bloqueios e riscos

Regras:
- Escrever em portugues, direto e objetivo.
- Consolidar achados tecnicos e implicacoes de negocio.
- Classificar risco por severidade: Alto, Medio, Baixo.
- Incluir decisoes recomendadas com justificativa.
- Definir plano de acao com owner e prazo.

Formato de saida obrigatorio:
1. Resumo executivo
2. Status por cenario (4/4)
3. Achados criticos consolidados
4. Riscos e severidade
5. Decisoes recomendadas
6. Plano de acao (owner, prazo, criterio de concluido)
7. Pendencias e proximos passos

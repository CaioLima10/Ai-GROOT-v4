---
name: "Orchestrated Suite Report Score"
description: "Gerar relatorio consolidado com semaforo e score numerico (0-100) por cenario e global"
argument-hint: "Informe resultados dos 4 cenarios, riscos, bloqueios e evidencias"
agent: "Architecture Review Tech Lead"
---
Gere um relatorio tecnico-executivo unico em markdown, consolidando os resultados da suite orquestrada com semaforo e score numerico.

Entrada esperada:
- Resultado do cenario 1: orchestrated-debug-smoke-test
- Resultado do cenario 2: orchestrated-llm-incident-smoke-test
- Resultado do cenario 3: orchestrated-ai-security-smoke-test
- Resultado do cenario 4: orchestrated-ai-resilience-smoke-test
- Evidencias tecnicas, bloqueios, impacto e mitigacoes

Regra de score por cenario (0-100):
- Confiabilidade do fluxo e handoffs (peso 30)
- Gravidade de risco residual (peso 30)
- Qualidade das evidencias e validacao (peso 20)
- Prontidao para escala/deploy (peso 20)

Regra de semaforo por cenario:
- Verde: score >= 80
- Amarelo: score entre 60 e 79
- Vermelho: score < 60

Regras obrigatorias:
- Escrever em portugues claro e objetivo.
- Atribuir score com justificativa curta e acionavel.
- Consolidar score global da suite (media dos 4 cenarios).
- Consolidar semaforo global com base no score global.
- Incluir plano de acao com owner, prazo e criterio de concluido.

Formato de saida obrigatorio:
1. Resumo executivo
2. Score e semaforo por cenario (4/4)
3. Score global da suite
4. Achados criticos consolidados
5. Decisoes recomendadas
6. Plano de acao (owner, prazo, criterio de concluido)
7. Bloqueios e proximo checkpoint

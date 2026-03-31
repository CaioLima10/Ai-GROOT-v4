---
description: "Use when: implementar features, corrigir bugs, refatorar módulos, ajustar API, melhorar performance ou alterar fluxos críticos. Define guardrails de qualidade, validação e segurança de mudanças."
name: "Engineering Quality Guardrails"
applyTo:
  - "core/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "api/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "apps/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "services/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "scripts/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "tests/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
  - "backend/**/*.{js,ts,jsx,tsx,mjs,cjs,json,md,yml,yaml}"
---
# Engineering Quality Guardrails

## Objetivo
Garantir mudanças seguras, verificáveis e com risco controlado em IA, backend/API, web e mobile.

## Regras de execução
- Confirmar causa raiz antes de aplicar correção em bug.
- Preferir mudanças pequenas, reversíveis e de baixo acoplamento.
- Evitar alterar contratos públicos sem descrever compatibilidade e impacto.
- Preservar padrões existentes do projeto (estilo, convenções e arquitetura).
- Não introduzir dependência nova sem justificar necessidade e custo operacional.

## Validação mínima
- Executar validação adequada ao escopo: teste, lint, build ou verificação funcional reproduzível.
- Se não for possível validar localmente, declarar explicitamente lacuna e risco residual.
- Para performance, sempre reportar baseline e resultado comparativo.

## Entrega
- Informar arquivos/símbolos alterados e objetivo de cada mudança.
- Explicar risco residual, rollback rápido e próximos passos.
- Priorizar clareza, concisão e ação prática.

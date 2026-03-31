# Estrutura Oficial do Projeto e Mapa de Portas

## Objetivo

Este documento define a arquitetura oficial do GIOM no monorepo, o que cada pasta faz, quais docs usar, e como os serviços se conectam por porta/rota.

## Runtime oficial (fonte de verdade)

- Backend oficial: `apps/api/src/server.js`
- Frontend oficial: `apps/web-next`
- Dev integrado: `npm run dev`

## Mapa de portas e conexões

- Frontend Next.js: `http://localhost:3001`
- Backend API: `http://localhost:3000`
- Bridge front -> back: rewrite no Next
  - origem: `/backend/:path*`
  - destino: `http://localhost:3000/:path*`
- Endpoints principais usados pelo front:
  - `GET /backend/config`
  - `POST /backend/ask`
  - `POST /backend/ask/stream`
  - `POST /backend/upload`

## Fluxo de requisição (chat)

1. Usuário envia mensagem no frontend (`apps/web-next`).
2. Front chama `/backend/ask` ou `/backend/ask/stream`.
3. Next reescreve para backend em `localhost:3000`.
4. Backend normaliza payload, aplica segurança/rate-limit e chama núcleo de IA.
5. Resposta retorna ao front pelo mesmo caminho `/backend/*`.

## Pastas principais do monorepo

- `apps/`
  - `api/`: backend HTTP oficial (Express + segurança + upload + stream)
  - `web-next/`: frontend oficial (Next.js)
  - `desktop/`: app desktop
- `packages/`
  - `ai-core/`: funções compartilhadas de IA (RAG, prompt, geração)
  - `shared-config/`: configuração compartilhada de perfis/capabilities
- `core/`
  - motor de IA e integrações (providers, memória, segurança lógica)
- `scripts/`
  - automações operacionais, QA e checks
- `docs/`
  - documentação operacional, deploy, segurança, troubleshooting
- `memory/`, `vectorMemory/`, `knowledge/`, `learning/`, `experience/`
  - camadas de conhecimento/memória e aprendizado

## Politica de frontend estatico legado

- Fluxo oficial: `apps/web-next`
- O backend oficial nao depende de frontend estatico legado.

## O que foi desativado para não atrapalhar

- Frontend estático legado no runtime do backend foi removido do fluxo oficial.
- A rota `/admin` não depende mais de UI antiga estática; agora responde JSON com links de diagnóstico.
- O script `dev:legacy` foi removido para evitar uso acidental de servidor legado.

## Docs essenciais (ordem recomendada)

1. `README.md` - visão geral e comandos principais
2. `docs/OPERATIONS-GIOM.md` - runbook operacional
3. `docs/PROJECT-STRUCTURE-PORTS.md` - estrutura/portas/conexões (este doc)
4. `docs/INTERNAL-BUG-PLAYBOOK.md` - guia interno de solução de bugs
5. `docs/SECURITY.md` e `docs/SAFETY-HARDENING.md` - segurança/safety

## Checklist rápido para subir ambiente

1. `npm install`
2. `npm run dev`
3. `npm run ops:check`
4. Abrir `http://localhost:3001`

## Regra de manutenção

- Qualquer integração nova deve usar o caminho `/backend/*` no frontend.
- Evitar URL hardcoded para backend direto no browser.
- Mudanças de porta exigem atualização em:
  - `apps/web-next/next.config.ts`
  - docs operacionais (`docs/OPERATIONS-GIOM.md` e este arquivo)

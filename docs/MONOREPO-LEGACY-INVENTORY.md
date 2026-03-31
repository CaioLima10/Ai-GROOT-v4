# Inventario de Legado Fora do Fluxo Oficial

## Objetivo

Mapear artefatos legados fora do fluxo oficial do monorepo sem remover nada agora, reduzindo risco de regressao.

## Fluxo oficial atual

- Backend oficial: apps/api/src/server.js
- Frontend oficial: apps/web-next
- Dev principal: npm run dev
- Check operacional: npm run ops:check

## Status de execucao do plano

- Fase 1 (congelar e sinalizar): concluida
- Fase 2 (encapsular legado): concluida
- Fase 3 (gate de operacao): concluida para runtime oficial
- Fase 4 (desativacao controlada): concluida para entrypoints historicos de servidor

## Artefatos de raiz com sinal de legado

### Entrypoints de servidor historicos

Arquivos removidos do repositório por nao participarem do fluxo oficial:

- server-definitivo.js
- server-final.js
- server-new.js
- server-simple.js
- server-smart.js
- server-test.js

Tambem removidos da API:

- apps/api/src/smartServer.js
- apps/api/src/smartServer.ts
- apps/api/src/legacyServer.js
- apps/api/src/legacyServer.ts

Status atual:

- nenhum script oficial aponta para entrypoint legado
- runtime oficial unico: `apps/api/src/server.js`

### Scripts de teste/debug ad-hoc na raiz

- debug-apis.js
- test-corrections.js
- test-debug.js
- test-debug.mjs
- test-groot.js
- test-memory.js
- test-openrouter.js

Status atual:

- debug-apis.js segue referenciado em npm run ai:test
- demais scripts nao estao no fluxo oficial de CI/ops

## Inconsistencias de documentacao detectadas

Foram detectadas referencias antigas para runtime legado em guias de deploy e setup.
As referencias criticas para start command ja foram atualizadas para apps/api/src/server.js.

## Plano de migracao em fases

### Fase 1 - Congelar e sinalizar (sem quebra)

1. Manter todos os arquivos legados no lugar.
2. Adicionar aviso de legado no topo dos arquivos de servidor de raiz.
3. Padronizar documentacao para usar somente apps/api/src/server.js e npm run dev.

### Fase 2 - Encapsular legado

1. Isolar artefatos legados para confirmar ausencia de dependencias ativas.
2. Validar fluxo oficial sem esses artefatos.
3. Preparar remocao definitiva.

### Fase 3 - Gate de operacao

1. Adicionar validacao no pre-deploy para bloquear start command legado.
2. Garantir que ops:check seja requisito de release.
3. Publicar tabela de ownership para cada area do monorepo.

### Fase 4 - Desativacao controlada

1. Definir janela de deprecacao com data.
2. Remover entrypoints antigos apos confirmacao de nao uso.
3. Manter changelog de remocao para rollback rapido.

## Criterio de sucesso

- Nenhuma referencia de deploy para entrpoints legados na raiz.
- Time operando somente com npm run dev e runtime oficial em apps/api/src/server.js.
- Legado preservado, mas claramente separado e documentado.

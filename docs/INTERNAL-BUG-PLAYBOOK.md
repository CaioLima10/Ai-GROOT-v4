# Playbook Interno de Bugs (GIOM)

## Objetivo

Guia prático para reproduzir, diagnosticar e resolver os incidentes mais comuns no front/back do GIOM.

## Regra de ouro

Sempre validar no caminho canônico:

- Frontend: `http://localhost:3001`
- API via proxy: `/backend/*`
- Backend real: `http://localhost:3000`

Rodar antes de qualquer hipótese longa:

- `npm run ops:check`

---

## Incidente A: `POST /backend/ask` retorna 500

### Sintoma (Incidente A)

- UI mostra erro no envio de mensagem.
- DevTools indica 500 em `/backend/ask`.

### Diagnóstico rápido (Incidente A)

1. Confirmar backend vivo: `GET /health`.
2. Executar `npm run ops:check`.
3. Verificar logs de erro do backend (`REQUEST_FAILED` e contexto de payload).
4. Confirmar se payload está em formato canônico `{ question, context }`.

### Causas comuns (Incidente A)

- `question` vazio após sanitização.
- `context` excessivo ou com formato inválido.
- Falha intermitente em provider upstream.

### Correção padrão (Incidente A)

1. Garantir payload canônico no frontend.
2. Reduzir contexto para mínimo em retry único quando 500.
3. Conferir env de provider (`OPENROUTER_API_KEY`, modelo, etc.).
4. Revalidar com `ops:check` + teste manual no chat.

---

## Incidente B: `Failed to fetch` no frontend

### Sintoma (Incidente B)

- Mensagem genérica de rede no cliente.
- Sem resposta HTTP útil.

### Diagnóstico rápido (Incidente B)

1. Verificar se frontend está chamando `/backend/...` e não URL direta errada.
2. Confirmar rewrite em `apps/web-next/next.config.ts`.
3. Confirmar backend escutando porta 3000.
4. Revisar CORS apenas quando houver acesso cross-origin real.

### Causas comuns (Incidente B)

- Backend parado.
- Porta trocada (`3000`/`3001`) ou rewrite incorreto.
- Falha TLS/proxy local.

### Correção padrão (Incidente B)

1. Reiniciar `npm run dev`.
2. Corrigir rewrite para `http://localhost:3000/:path*`.
3. Evitar fallback direto para backend no browser, salvo flag explícita.

---

## Incidente C: Hydration warning no Next (atributos extras)

### Sintoma (Incidente C)

- Warning de hidratação no console sobre atributos extras em `html`/`body`.

### Diagnóstico rápido (Incidente C)

1. Testar janela anônima sem extensões.
2. Verificar se warning some sem extensões de navegador.

### Causas comuns (Incidente C)

- Extensão injetando atributos no DOM antes da hidratação.

### Correção padrão (Incidente C)

1. Usar `suppressHydrationWarning` em `html` e `body` no layout raiz.
2. Não confundir esse warning com erro de API.

---

## Incidente D: Stream (`/backend/ask/stream`) não entrega chunks

### Sintoma (Incidente D)

- Requisição abre, mas sem eventos úteis até timeout/fim.

### Diagnóstico rápido (Incidente D)

1. Confirmar headers SSE corretos no backend.
2. Verificar se front está lendo `ReadableStream` corretamente.
3. Testar endpoint com request mínimo canônico.

### Causas comuns (Incidente D)

- Handler cai em erro e envia apenas evento final.
- Provider não retorna stream incremental na configuração atual.

### Correção padrão (Incidente D)

1. Validar fallback para resposta única quando stream não disponível.
2. Melhorar logs de eventos `meta/chunk/complete/error`.
3. Reexecutar `ops:check` para path de stream.

---

## Incidente E: Funciona no código, falha no ambiente

### Sintoma (Incidente E)

- Testes locais pontuais passam, mas UI real falha intermitente.

### Diagnóstico rápido (Incidente E)

1. Confirmar processo ativo correto (não servidor antigo).
2. Confirmar branch/arquivos realmente carregados pelo processo.
3. Validar variáveis de ambiente efetivas no runtime.

### Causas comuns (Incidente E)

- Processo legado rodando em paralelo.
- Mudança aplicada em arquivo não usado pelo entrypoint.

### Correção padrão (Incidente E)

1. Padronizar execução via `npm run dev`.
2. Remover atalhos legados ambíguos.
3. Centralizar observabilidade em logs de erro estruturados.

---

## Procedimento padrão de resposta a incidente

1. Reproduzir com o menor payload possível.
2. Coletar evidência: status code, endpoint, body shape, timestamp.
3. Rodar `npm run ops:check`.
4. Isolar camada: frontend, proxy/rewrite, backend, provider.
5. Aplicar correção mínima.
6. Revalidar automático + teste manual.
7. Registrar no changelog interno com causa raiz e prevenção.

## Critérios de pronto

- Erro reproduzido e causa raiz identificada.
- Correção validada por `ops:check` e fluxo manual.
- Sem regressão em `ask` e `ask/stream`.
- Documentação atualizada (este playbook + doc de estrutura/portas).

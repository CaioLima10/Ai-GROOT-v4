# Free AI Stack for Ai-GROOT

## Objetivo

Deixar o projeto operando com uma base gratuita ou de custo quase zero agora, sem fechar a porta para uma migracao futura para OpenAI/GPT.

## Stack recomendado hoje

- Chat e codigo: `Ollama` local como padrao quando voce tiver maquina para isso.
- Chat e codigo em nuvem sem custo inicial: `OpenRouter` com `openrouter/free`.
- Backup rapido em nuvem: `Groq`.
- Funcoes, tool calling e multimodal leve: `Gemini`.
- Embeddings gratis: `Ollama` com `embeddinggemma` ou fallback local do proprio projeto.

## Mapeamento por capacidade

- Models gerais, chat, codigo e assistente: `Ollama`, `OpenRouter`, `Groq`, `Gemini`.
- Tool calling e agent loop: `Ollama`, `Groq`, `Gemini`, `OpenRouter`.
- Streaming de resposta: `Ollama`, `Groq`, `Gemini`, `OpenRouter`.
- Embeddings: `Ollama` ou fallback local.
- Geracao de imagem e logo: `ComfyUI` local com modelos open source.
- OCR: `tesseract.js` ja existe no projeto.
- Zip: `archiver` ou `jszip`.
- Excel e tabelas: `xlsx` ou `SheetJS CE`.
- Word: `docx`.
- PDF: `pdf-lib`.
- SVG escalavel e multisize: SVG nativo + `svgo` para otimizar + `sharp` para rasterizar tamanhos derivados quando necessario.

## O que ja existe no projeto

- Provider multiplo no backend.
- Upload temporario com OCR opcional.
- Fallback local de embeddings.
- Estrutura pronta para ligar `OpenAI` depois sem reescrever o core.

## Estrategia de migracao futura para GPT

1. Manter `GROOT_AI_PROVIDER=auto` em desenvolvimento.
2. Usar `OLLAMA_ENABLED=true` para rodar localmente sem custo.
3. Se precisar de nuvem gratis, usar `OPENROUTER_KEY` com `OPENROUTER_MODEL=openrouter/free`.
4. Quando houver verba, ativar `OPENAI_API_KEY` e mudar `GROOT_AI_PROVIDER=openai`.
5. Depois disso, trocar os endpoints principais para um fluxo estilo `Responses API` com streaming e tools reais.

## Observacao importante

Ai-GROOT ja tem API propria de aplicacao, porque expoe endpoints como `/ask`, `/upload`, `/health` e `/config`.

O que ele ainda nao tem e um modelo-base proprio treinado e servido por infraestrutura propria no nivel de OpenAI, Anthropic ou Google. Hoje ele funciona como uma camada de produto e orquestracao sobre providers externos ou locais.

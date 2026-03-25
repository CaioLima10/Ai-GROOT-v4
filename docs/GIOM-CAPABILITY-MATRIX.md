# GIOM Capability Matrix

Este documento resume o estado real das capacidades do GIOM na runtime atual.

## Pronto hoje
- Chat e streaming
- Memoria curta, perfil do usuario e resumos
- RAG com base curada e conhecimento aprendido
- Leitura de texto, markdown, JSON, codigo e configs como texto
- Leitura de PDF com extracao de texto
- Leitura de DOCX com extracao de texto
- Leitura de XLSX com extracao tabular basica
- Leitura de PPTX com extracao basica de texto dos slides
- Leitura de SVG como texto
- OCR de imagem quando `UPLOAD_OCR_ENABLED=true`
- Exportacao de conversa em PDF pelo navegador
- Redacao de dados sensiveis antes de persistir memoria
- Bloqueio de aprendizado persistente quando ha segredo, token, cartao, CPF, CNPJ ou dado bancario

## Parcial
- Upload de imagem sem OCR ainda nao extrai sentido visual geral, apenas texto quando OCR estiver ligado
- Geracao de imagem depende de provider ativo, hoje via Hugging Face
- Geracao de documentos estruturados acontece no chat em texto, markdown, HTML ou JSON, mas nem todo formato binario vira arquivo nativo
- Office esta parcial: `DOCX/XLSX/PPTX` entram com leitura basica, mas formatos binarios mais complexos e cobertura Office completa ainda nao

## Ainda nao integrado
- Pesquisa web ao vivo com Google, Bing ou Yahoo
- Inspecao generica de binarios arbitrarios
- Geracao server-side de PDF como arquivo nativo

## Endpoints uteis
- `GET /config`
- `GET /capabilities`
- `GET /knowledge/status`
- `GET /evaluation/packs`

## Observacao importante
O objetivo da matriz e honestidade operacional. O GIOM nao deve fingir web ao vivo, parser de Office ou geracao binaria quando isso nao estiver realmente ligado na runtime.

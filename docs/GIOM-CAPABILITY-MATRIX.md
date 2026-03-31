# GIOM Capability Matrix

Este documento resume o estado real das capacidades do GIOM na runtime atual.

## Pronto hoje
- Chat e streaming
- Memoria curta, perfil do usuario e resumos
- RAG com base curada e conhecimento aprendido
- Leitura de texto, markdown, JSON, codigo e configs como texto
- Leitura de PDF com extracao de texto
- Leitura de ZIP com extracao de arquivos textuais internos
- Leitura de DOCX com extracao de texto
- Leitura de XLSX com extracao tabular basica
- Leitura de PPTX com extracao basica de texto dos slides
- Leitura de SVG como texto
- Geracao de imagem por prompt quando houver provider ativo
- Controles de imagem via preset visual, negative prompt, proporcao, dimensoes e seed
- Geracao server-side de PDF como arquivo nativo
- Geracao nativa de DOCX, XLSX, PPTX, SVG, HTML, Markdown, TXT e JSON
- OCR de imagem quando `UPLOAD_OCR_ENABLED=true`
- Exportacao de conversa em PDF pelo navegador
- Redacao de dados sensiveis antes de persistir memoria
- Bloqueio de aprendizado persistente quando ha segredo, token, cartao, CPF, CNPJ ou dado bancario

## Parcial
- Upload de imagem sem OCR ainda nao extrai sentido visual geral, apenas texto quando OCR estiver ligado
- Geracao de imagem depende de provider ativo, hoje via Hugging Face
- Entendimento visual geral de imagem ainda esta abaixo de OCR multimodal completo
- Office esta parcial: `DOCX/XLSX/PPTX` entram com leitura basica, mas formatos binarios mais complexos e cobertura Office completa ainda nao

## Ainda nao integrado
- Pesquisa web ao vivo com Google, Bing ou Yahoo
- Edicao de imagem por referencia, inpainting e variacoes locais
- Inspecao generica de binarios arbitrarios

## Endpoints uteis
- `GET /config`
- `GET /capabilities`
- `GET /knowledge/status`
- `GET /evaluation/packs`
- `POST /generate/document`
- `POST /generate/image`
- `npm run eval:giom:audit`

## Observacao importante
O objetivo da matriz e honestidade operacional. O GIOM nao deve fingir web ao vivo, parser de Office completo, entendimento visual multimodal de ponta ou automacao total de escritorio quando isso nao estiver realmente ligado na runtime.

# Document Reader - Plano de Execucao

## Objetivo

Construir um leitor documental superior para o caso GIOM, com pipeline hibrido (texto nativo + OCR + validacao de qualidade), integrando Next.js no produto e Python no motor de leitura.

## Recomendacoes aplicadas

1. Next.js no produto
2. Microservico Python FastAPI para leitura
3. Pipeline inicial com PyMuPDF + PaddleOCR + fallback Tesseract
4. Benchmark com documentos reais antes de escalar

## Fase 1 - Base Tecnica (concluida neste ciclo)

- [x] Criar microservico Python em services/document-reader
- [x] Expor endpoint POST /v1/extract e GET /health
- [x] Integrar fallback externo no runtime atual (PDF e imagem)
- [x] Variaveis de ambiente para habilitar/desabilitar leitor externo

## Fase 2 - Qualidade e Benchmark

- [ ] Montar dataset de 100 documentos reais (PDF nativo, PDF escaneado, imagens, DOCX)
- [ ] Definir ground truth de 20 documentos criticos
- [ ] Medir CER/WER e cobertura por secao
- [ ] Definir score minimo de aprovacao por tipo de documento

## Fase 3 - Pipeline Avancado

- [ ] Adicionar extração estruturada (titulos, tabelas, secoes)
- [ ] OCR por pagina com reprocessamento seletivo
- [ ] Detectar idioma e ruído automaticamente
- [ ] Roteamento por tipo de documento (pdf nativo vs scan)

## Fase 4 - Producao e Escala

- [x] Fila assíncrona inicial (in-memory worker)
- [x] Retries com backoff (configuravel por env)
- [x] Observabilidade inicial (/metrics: latencia, erro, retries)
- [ ] Controle de custo e limite por usuario
- [ ] Evoluir para Redis + worker dedicado + DLQ persistente

## Flags de Runtime

No backend Node:

- UPLOAD_EXTERNAL_READER_ENABLED=true
- UPLOAD_EXTERNAL_READER_URL=`http://127.0.0.1:8090`
- UPLOAD_EXTERNAL_READER_TIMEOUT_MS=20000
- UPLOAD_EXTERNAL_READER_API_KEY=

## Execucao local

1. Instalar dependencias Python:
   - npm run doc-reader:install
2. Subir leitor:
   - npm run doc-reader:dev
3. Testar health:
   - npm run doc-reader:health
4. Ativar fallback externo no .env
5. Subir API:
   - npm run dev:api
6. Rodar smoke end-to-end:
   - npm run doc-reader:smoke
7. Rodar smoke assíncrono:
   - npm run doc-reader:async-smoke
8. Rodar benchmark inicial:
   - npm run doc-reader:benchmark

## Criterio de sucesso inicial

- >= 95% documentos processados sem erro tecnico
- Reducao de casos "quality=none" em uploads PDF/imagem
- Latencia p95 por arquivo menor que 15s no ambiente local

## Politica Freemium de Upload

- Anonimo: 5 uploads por 24h
- Login: 9 uploads por 24h
- Pago: limite superior configuravel (default 120 por 24h)
- Endpoint de consulta: GET /upload/quota

## Politica Freemium de Imagem (estilo ChatGPT)

- Anonimo: 2 geracoes de imagem por 24h
- Login: 4 geracoes de imagem por 24h
- Pago: limite superior configuravel (default 80 por 24h)
- Endpoint de limites unificados: GET /usage/limits

## Bateria de Testes

- Unitario de quota runtime:
  - npm run test:quota-runtime
- Bateria freemium da API (com relatorio):
  - npm run battery:freemium
- Health + smoke do leitor:
  - npm run doc-reader:health
  - npm run doc-reader:smoke
  - npm run doc-reader:async-smoke
- Metricas do leitor:
  - npm run doc-reader:metrics
- Benchmark de extracao documental:
  - npm run doc-reader:benchmark

# GIOM Document Reader Service

Microservico Python para extracao de texto de PDF e imagem com OCR hibrido.

## Stack

- FastAPI (API)
- PyMuPDF (texto nativo PDF)
- PaddleOCR (OCR principal)
- Tesseract (fallback)

## Rodar local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

## Endpoint

- POST /v1/extract (multipart/form-data)
  - file: arquivo
  - kind: auto | pdf | image
  - limit: tamanho maximo de texto retornado
- POST /v1/extract/async (multipart/form-data)
  - file: arquivo
  - kind: auto | pdf | image | text
  - limit: tamanho maximo de texto retornado
  - retorno: jobId para consulta posterior
- GET /v1/extract/jobs/{jobId}
  - status: queued | running | done | failed

## Health

- GET /health
- GET /metrics
  - contadores de requests, retries, erros e latencia
- GET /v1/extract/dlq
  - itens em dead-letter queue (quando backend Redis estiver ativo)

## Saida estruturada

O retorno inclui campos extras para pipeline de qualidade:

- sections: secoes detectadas (titulo + linha de inicio)
- tableSignals: linhas com padrao de tabela (pipe, tab ou ponto e virgula)

## Variaveis

- DOC_READER_TEXT_LIMIT=12000
- DOC_READER_OCR_LANG=pt
- DOC_READER_ENABLE_PADDLE=true
- DOC_READER_API_KEY=
- DOC_READER_MAX_RETRIES=2
- DOC_READER_RETRY_BASE_MS=800
- DOC_READER_MAX_QUEUE_JOBS=2000
- DOC_READER_MAX_LATENCY_SAMPLES=1000
- DOC_READER_QUEUE_BACKEND=memory
- DOC_READER_REDIS_URL=redis://127.0.0.1:6379/0
- DOC_READER_REDIS_QUEUE_KEY=doc_reader:queue
- DOC_READER_REDIS_DLQ_KEY=doc_reader:dlq
- DOC_READER_REDIS_JOB_KEY_PREFIX=doc_reader:job:

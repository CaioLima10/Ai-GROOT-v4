from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import tempfile
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

try:
    import fitz  # type: ignore
except Exception:  # pragma: no cover
    fitz = None

try:
    from paddleocr import PaddleOCR  # type: ignore
except Exception:  # pragma: no cover
    PaddleOCR = None

try:
    import pytesseract  # type: ignore
except Exception:  # pragma: no cover
    pytesseract = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

try:
    import redis.asyncio as redis_async  # type: ignore
except Exception:  # pragma: no cover
    redis_async = None

APP_NAME = "GIOM Document Reader"
APP_VERSION = "0.1.0"
DEFAULT_TEXT_LIMIT = int(os.getenv("DOC_READER_TEXT_LIMIT", "12000"))
OCR_LANG = os.getenv("DOC_READER_OCR_LANG", "pt")
ENABLE_PADDLE = os.getenv("DOC_READER_ENABLE_PADDLE", "true").lower() == "true"
API_KEY = os.getenv("DOC_READER_API_KEY", "").strip()
MAX_RETRIES = max(0, int(os.getenv("DOC_READER_MAX_RETRIES", "2")))
RETRY_BASE_MS = max(100, int(os.getenv("DOC_READER_RETRY_BASE_MS", "800")))
MAX_QUEUE_JOBS = max(100, int(os.getenv("DOC_READER_MAX_QUEUE_JOBS", "2000")))
MAX_LATENCY_SAMPLES = max(100, int(os.getenv("DOC_READER_MAX_LATENCY_SAMPLES", "1000")))
QUEUE_BACKEND = os.getenv("DOC_READER_QUEUE_BACKEND", "memory").strip().lower()
REDIS_URL = os.getenv("DOC_READER_REDIS_URL", "redis://127.0.0.1:6379/0").strip()
REDIS_QUEUE_KEY = os.getenv("DOC_READER_REDIS_QUEUE_KEY", "doc_reader:queue").strip()
REDIS_DLQ_KEY = os.getenv("DOC_READER_REDIS_DLQ_KEY", "doc_reader:dlq").strip()
REDIS_JOB_KEY_PREFIX = os.getenv("DOC_READER_REDIS_JOB_KEY_PREFIX", "doc_reader:job:").strip()

app = FastAPI(title=APP_NAME, version=APP_VERSION)

_ocr_engine: Any = None
_jobs: dict[str, dict[str, Any]] = {}
_job_queue: asyncio.Queue[str] = asyncio.Queue()
_worker_task: asyncio.Task[Any] | None = None
_redis: Any = None
_queue_backend = "memory"
_metrics: dict[str, Any] = {
    "syncRequests": 0,
    "asyncSubmitted": 0,
    "asyncCompleted": 0,
    "asyncFailed": 0,
    "retriesScheduled": 0,
    "totalErrors": 0,
    "latencySamplesMs": [],
}


def _job_redis_key(job_id: str) -> str:
    return f"{REDIS_JOB_KEY_PREFIX}{job_id}"


def _serialize_job(job: dict[str, Any]) -> str:
    payload = job.get("payload") or {}
    data = payload.get("data")
    data_b64 = ""
    if isinstance(data, (bytes, bytearray)):
        data_b64 = base64.b64encode(bytes(data)).decode("ascii")

    normalized = {
        "status": job.get("status"),
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
        "attempts": int(job.get("attempts") or 0),
        "nextRetryAt": job.get("nextRetryAt"),
        "result": job.get("result"),
        "error": job.get("error"),
        "payload": {
            "fileName": payload.get("fileName"),
            "contentType": payload.get("contentType"),
            "kind": payload.get("kind"),
            "limit": payload.get("limit"),
            "dataB64": data_b64,
        }
    }
    return json.dumps(normalized, ensure_ascii=True)


def _deserialize_job(raw: str) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        payload = parsed.get("payload") or {}
        data_b64 = str(payload.get("dataB64") or "")
        decoded = base64.b64decode(data_b64) if data_b64 else None
        return {
            "status": parsed.get("status", "queued"),
            "createdAt": parsed.get("createdAt", _utc_now_iso()),
            "updatedAt": parsed.get("updatedAt", _utc_now_iso()),
            "attempts": int(parsed.get("attempts") or 0),
            "nextRetryAt": parsed.get("nextRetryAt"),
            "result": parsed.get("result"),
            "error": parsed.get("error"),
            "payload": {
                "data": decoded,
                "fileName": payload.get("fileName") or "upload.bin",
                "contentType": payload.get("contentType") or "",
                "kind": payload.get("kind") or "auto",
                "limit": int(payload.get("limit") or DEFAULT_TEXT_LIMIT),
            }
        }
    except Exception:
        return None


async def _persist_job(job_id: str) -> None:
    if _queue_backend != "redis" or _redis is None:
        return
    job = _jobs.get(job_id)
    if not job:
        return
    await _redis.set(_job_redis_key(job_id), _serialize_job(job))


async def _load_job(job_id: str) -> dict[str, Any] | None:
    if job_id in _jobs:
        return _jobs.get(job_id)
    if _queue_backend != "redis" or _redis is None:
        return None
    raw = await _redis.get(_job_redis_key(job_id))
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="ignore")
    job = _deserialize_job(str(raw))
    if job:
        _jobs[job_id] = job
    return job


async def _enqueue_job(job_id: str) -> None:
    if _queue_backend == "redis" and _redis is not None:
        await _redis.rpush(REDIS_QUEUE_KEY, job_id)
        return
    await _job_queue.put(job_id)


async def _dequeue_job_id() -> str:
    if _queue_backend == "redis" and _redis is not None:
        popped = await _redis.blpop(REDIS_QUEUE_KEY, timeout=2)
        if not popped:
            return ""
        value = popped[1]
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="ignore")
        return str(value)
    return await _job_queue.get()


async def _dlq_push(job_id: str, job: dict[str, Any]) -> None:
    if _queue_backend != "redis" or _redis is None:
        return
    payload = job.get("payload") or {}
    dead = {
        "jobId": job_id,
        "failedAt": _utc_now_iso(),
        "attempts": int(job.get("attempts") or 0),
        "error": str(job.get("error") or "unknown"),
        "kind": str(payload.get("kind") or "unknown"),
        "fileName": str(payload.get("fileName") or "upload.bin")
    }
    await _redis.rpush(REDIS_DLQ_KEY, json.dumps(dead, ensure_ascii=True))


class ExtractSection(BaseModel):
    title: str
    startLine: int


class ExtractTableSignal(BaseModel):
    line: int
    text: str


class ExtractResponse(BaseModel):
    ok: bool
    kind: str
    method: str
    quality: str
    text: str
    fullTextLength: int
    truncated: bool
    pages: int | None = None
    warnings: list[str] = []
    sections: list[ExtractSection] = []
    tableSignals: list[ExtractTableSignal] = []


class ExtractAsyncAccepted(BaseModel):
    ok: bool
    jobId: str
    status: str


class ExtractJobStatus(BaseModel):
    ok: bool
    jobId: str
    status: str
    createdAt: str
    updatedAt: str
    attempts: int = 0
    nextRetryAt: str | None = None
    result: ExtractResponse | None = None
    error: str | None = None


def _init_ocr_engine() -> Any:
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    if ENABLE_PADDLE and PaddleOCR is not None:
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang=OCR_LANG)
    else:
        _ocr_engine = "tesseract"
    return _ocr_engine


def _quality(text: str, warnings: list[str]) -> str:
    cleaned = text.strip()
    if not cleaned:
        return "none"
    if len(warnings) >= 2:
        return "low"
    if len(warnings) == 1:
        return "medium"
    return "high"


def _limit_text(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit].rstrip() + "\n... (truncado)", True


def _build_sections(text: str) -> list[ExtractSection]:
    sections: list[ExtractSection] = []
    lines = text.splitlines()

    for idx, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue

        is_short = len(line) <= 80
        is_upper = line.isupper() and len(line) >= 5
        starts_numbered = line[:3].count(".") == 1 and line[0].isdigit()
        starts_heading_word = line.lower().startswith(("capitulo", "secao", "section", "titulo", "chapter"))

        if is_short and (is_upper or starts_numbered or starts_heading_word):
            sections.append(ExtractSection(title=line, startLine=idx))

        if len(sections) >= 30:
            break

    return sections


def _build_table_signals(text: str) -> list[ExtractTableSignal]:
    signals: list[ExtractTableSignal] = []
    lines = text.splitlines()

    for idx, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue

        pipe_cols = line.count("|") >= 2
        semicolon_cols = line.count(";") >= 2
        tab_cols = line.count("\t") >= 2

        if pipe_cols or semicolon_cols or tab_cols:
            signals.append(ExtractTableSignal(line=idx, text=line[:180]))

        if len(signals) >= 30:
            break

    return signals


def _extract_pdf_text(data: bytes) -> tuple[str, int | None, str, list[str]]:
    warnings: list[str] = []
    if fitz is None:
        return "", None, "pdf-unavailable", ["pymupdf nao disponivel"]

    doc = fitz.open(stream=data, filetype="pdf")
    pages = doc.page_count
    chunks: list[str] = []

    for i in range(pages):
        try:
            page = doc.load_page(i)
            text = page.get_text("text") or ""
            if text.strip():
                chunks.append(text)
        except Exception:
            continue

    direct_text = "\n\n".join(chunks).strip()
    if len(direct_text) >= 400:
        return direct_text, pages, "pymupdf", warnings

    warnings.append("texto PDF nativo insuficiente; aplicando OCR")
    ocr_text = _ocr_pdf(doc)
    merged = (direct_text + "\n\n" + ocr_text).strip() if ocr_text else direct_text
    method = "pymupdf+paddleocr" if "paddle" in _ocr_method_label() else "pymupdf+tesseract"
    return merged, pages, method, warnings


def _ocr_method_label() -> str:
    engine = _init_ocr_engine()
    return "paddleocr" if engine != "tesseract" else "tesseract"


def _ocr_image_bytes(image_bytes: bytes) -> str:
    engine = _init_ocr_engine()
    if Image is None:
        return ""

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    if engine == "tesseract":
        if pytesseract is None:
            return ""
        return (pytesseract.image_to_string(image, lang=OCR_LANG) or "").strip()

    with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
        image.save(tmp.name, format="PNG")
        result = engine.ocr(tmp.name, cls=True)

    lines: list[str] = []
    for block in result or []:
        for row in block or []:
            if len(row) >= 2 and row[1] and row[1][0]:
                lines.append(str(row[1][0]).strip())
    return "\n".join([line for line in lines if line])


def _ocr_pdf(doc: Any) -> str:
    lines: list[str] = []
    max_pages = min(getattr(doc, "page_count", 0), 8)

    for i in range(max_pages):
        try:
            page = doc.load_page(i)
            pix = page.get_pixmap(dpi=220)
            text = _ocr_image_bytes(pix.tobytes("png"))
            if text.strip():
                lines.append(f"Pagina {i + 1}\n{text.strip()}")
        except Exception:
            continue

    return "\n\n".join(lines).strip()


def _extract_image_text(data: bytes) -> tuple[str, str, list[str]]:
    text = _ocr_image_bytes(data)
    if not text.strip():
        return "", f"{_ocr_method_label()}", ["OCR nao extraiu texto util"]
    return text, f"{_ocr_method_label()}", []


def _extract_text_file(data: bytes) -> tuple[str, str, list[str]]:
    for encoding in ("utf-8", "latin-1"):
        try:
            text = data.decode(encoding)
            return text.strip(), f"plain:{encoding}", []
        except Exception:
            continue
    return "", "plain:decode-failed", ["arquivo de texto nao pode ser decodificado"]


def _validate_api_key(authorization: str | None) -> None:
    if not API_KEY:
        return
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def _extract_sync(data: bytes, file_name: str, content_type: str, kind: str, limit: int) -> ExtractResponse:
    normalized_kind = (kind or "auto").strip().lower()
    content_type = (content_type or "").lower()

    if normalized_kind == "auto":
        if content_type == "application/pdf" or file_name.lower().endswith(".pdf"):
            normalized_kind = "pdf"
        elif content_type.startswith("image/"):
            normalized_kind = "image"
        elif content_type.startswith("text/"):
            normalized_kind = "text"
        elif file_name.lower().endswith((".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".log")):
            normalized_kind = "text"
        else:
            normalized_kind = "binary"

    warnings: list[str] = []
    pages: int | None = None

    if normalized_kind == "pdf":
        text, pages, method, local_warnings = _extract_pdf_text(data)
        warnings.extend(local_warnings)
    elif normalized_kind == "image":
        text, method, local_warnings = _extract_image_text(data)
        warnings.extend(local_warnings)
    elif normalized_kind == "text":
        text, method, local_warnings = _extract_text_file(data)
        warnings.extend(local_warnings)
    else:
        text = ""
        method = "unsupported"
        warnings.append("tipo de arquivo nao suportado por este endpoint")

    preview, truncated = _limit_text(text, max(1000, int(limit)))
    quality = _quality(text, warnings)
    sections = _build_sections(text)
    table_signals = _build_table_signals(text)

    return ExtractResponse(
        ok=quality != "none",
        kind=normalized_kind,
        method=method,
        quality=quality,
        text=preview,
        fullTextLength=len(text),
        truncated=truncated,
        pages=pages,
        warnings=warnings[:4],
        sections=sections,
        tableSignals=table_signals,
    )


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _push_latency(ms: float) -> None:
    values = _metrics["latencySamplesMs"]
    values.append(round(ms, 2))
    if len(values) > MAX_LATENCY_SAMPLES:
        del values[0:len(values) - MAX_LATENCY_SAMPLES]


def _calculate_latency_stats() -> dict[str, float]:
    values = [float(v) for v in _metrics.get("latencySamplesMs", [])]
    if not values:
        return {"avgMs": 0.0, "p95Ms": 0.0, "maxMs": 0.0}

    ordered = sorted(values)
    p95_idx = max(0, min(len(ordered) - 1, int(len(ordered) * 0.95) - 1))
    avg = sum(ordered) / len(ordered)
    return {
        "avgMs": round(avg, 2),
        "p95Ms": round(ordered[p95_idx], 2),
        "maxMs": round(ordered[-1], 2),
    }


async def _requeue_later(job_id: str, delay_ms: int) -> None:
    await asyncio.sleep(max(0.05, delay_ms / 1000.0))
    if job_id in _jobs:
        await _enqueue_job(job_id)


async def _run_async_job(job_id: str) -> None:
    job = await _load_job(job_id)
    if not job:
        return

    payload = job.get("payload") or {}
    data = payload.get("data")
    file_name = str(payload.get("fileName") or "upload.bin")
    content_type = str(payload.get("contentType") or "")
    kind = str(payload.get("kind") or "auto")
    limit = int(payload.get("limit") or DEFAULT_TEXT_LIMIT)

    if not isinstance(data, (bytes, bytearray)):
        job["status"] = "failed"
        job["error"] = "payload ausente para processamento"
        job["updatedAt"] = _utc_now_iso()
        _metrics["asyncFailed"] += 1
        _metrics["totalErrors"] += 1
        return

    job["status"] = "running"
    job["attempts"] = int(job.get("attempts") or 0) + 1
    job["nextRetryAt"] = None
    job["updatedAt"] = _utc_now_iso()
    await _persist_job(job_id)
    started = time.perf_counter()

    try:
        result = _extract_sync(data, file_name, content_type, kind, limit)
        job["status"] = "done"
        job["result"] = result.model_dump()
        job["payload"] = None
        job["updatedAt"] = _utc_now_iso()
        _metrics["asyncCompleted"] += 1
        await _persist_job(job_id)
    except Exception as error:  # pragma: no cover
        attempts = int(job.get("attempts") or 1)
        if attempts <= MAX_RETRIES:
            delay_ms = RETRY_BASE_MS * (2 ** (attempts - 1))
            next_retry = datetime.now(timezone.utc).timestamp() + (delay_ms / 1000.0)
            job["status"] = "queued"
            job["error"] = str(error)
            job["nextRetryAt"] = datetime.fromtimestamp(next_retry, tz=timezone.utc).isoformat()
            job["updatedAt"] = _utc_now_iso()
            _metrics["retriesScheduled"] += 1
            await _persist_job(job_id)
            asyncio.create_task(_requeue_later(job_id, delay_ms))
        else:
            job["status"] = "failed"
            job["error"] = str(error)
            await _dlq_push(job_id, job)
            job["payload"] = None
            job["updatedAt"] = _utc_now_iso()
            _metrics["asyncFailed"] += 1
            _metrics["totalErrors"] += 1
            await _persist_job(job_id)
    finally:
        elapsed_ms = (time.perf_counter() - started) * 1000
        _push_latency(elapsed_ms)


async def _worker_loop() -> None:
    while True:
        job_id = await _dequeue_job_id()
        try:
            if not job_id:
                continue
            if job_id == "__STOP__":
                return
            await _run_async_job(job_id)
        finally:
            if _queue_backend != "redis":
                _job_queue.task_done()


@app.on_event("startup")
async def on_startup() -> None:
    global _worker_task, _redis, _queue_backend
    if QUEUE_BACKEND == "redis" and redis_async is not None:
        try:
            _redis = redis_async.from_url(REDIS_URL, decode_responses=False)
            await _redis.ping()
            _queue_backend = "redis"
        except Exception:
            _redis = None
            _queue_backend = "memory"
    else:
        _queue_backend = "memory"
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global _worker_task, _redis
    if _worker_task is not None and not _worker_task.done():
        await _enqueue_job("__STOP__")
        await _worker_task
    _worker_task = None
    if _redis is not None:
        await _redis.aclose()
        _redis = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "version": APP_VERSION,
        "ocr": _ocr_method_label(),
        "auth": bool(API_KEY),
        "jobs": len(_jobs),
        "queueBackend": _queue_backend,
        "queueSize": _job_queue.qsize() if _queue_backend != "redis" else None,
        "maxRetries": MAX_RETRIES,
    }


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "counters": {
            "syncRequests": int(_metrics.get("syncRequests", 0)),
            "asyncSubmitted": int(_metrics.get("asyncSubmitted", 0)),
            "asyncCompleted": int(_metrics.get("asyncCompleted", 0)),
            "asyncFailed": int(_metrics.get("asyncFailed", 0)),
            "retriesScheduled": int(_metrics.get("retriesScheduled", 0)),
            "totalErrors": int(_metrics.get("totalErrors", 0)),
        },
        "latency": _calculate_latency_stats(),
        "queue": {
            "backend": _queue_backend,
            "size": _job_queue.qsize() if _queue_backend != "redis" else None,
            "maxJobs": MAX_QUEUE_JOBS,
        },
        "jobs": {
            "total": len(_jobs),
            "queued": len([1 for j in _jobs.values() if j.get("status") == "queued"]),
            "running": len([1 for j in _jobs.values() if j.get("status") == "running"]),
            "done": len([1 for j in _jobs.values() if j.get("status") == "done"]),
            "failed": len([1 for j in _jobs.values() if j.get("status") == "failed"]),
        },
    }


@app.post("/v1/extract", response_model=ExtractResponse)
async def extract_document(
    file: UploadFile = File(...),
    kind: str = Form("auto"),
    limit: int = Form(DEFAULT_TEXT_LIMIT),
    authorization: str | None = Header(default=None),
) -> ExtractResponse:
    _validate_api_key(authorization)
    _metrics["syncRequests"] += 1
    started = time.perf_counter()
    data = await file.read()
    try:
        return _extract_sync(
            data=data,
            file_name=file.filename or "upload.bin",
            content_type=file.content_type or "",
            kind=kind,
            limit=max(1000, int(limit)),
        )
    except Exception:
        _metrics["totalErrors"] += 1
        raise
    finally:
        _push_latency((time.perf_counter() - started) * 1000)


@app.post("/v1/extract/async", response_model=ExtractAsyncAccepted)
async def extract_document_async(
    file: UploadFile = File(...),
    kind: str = Form("auto"),
    limit: int = Form(DEFAULT_TEXT_LIMIT),
    authorization: str | None = Header(default=None),
) -> ExtractAsyncAccepted:
    _validate_api_key(authorization)
    _metrics["asyncSubmitted"] += 1

    if len(_jobs) >= MAX_QUEUE_JOBS:
        raise HTTPException(status_code=503, detail="queue capacity exceeded")

    data = await file.read()
    file_name = file.filename or "upload.bin"
    content_type = file.content_type or ""
    normalized_limit = max(1000, int(limit))

    job_id = uuid.uuid4().hex
    now = _utc_now_iso()
    _jobs[job_id] = {
        "status": "queued",
        "createdAt": now,
        "updatedAt": now,
        "attempts": 0,
        "nextRetryAt": None,
        "result": None,
        "error": None,
        "payload": {
            "data": data,
            "fileName": file_name,
            "contentType": content_type,
            "kind": kind,
            "limit": normalized_limit,
        },
    }
    await _persist_job(job_id)
    await _enqueue_job(job_id)

    return ExtractAsyncAccepted(ok=True, jobId=job_id, status="queued")


@app.get("/v1/extract/jobs/{job_id}", response_model=ExtractJobStatus)
async def extract_document_job(job_id: str, authorization: str | None = Header(default=None)) -> ExtractJobStatus:
    _validate_api_key(authorization)
    job = await _load_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")

    result = ExtractResponse(**job["result"]) if isinstance(job.get("result"), dict) else None
    return ExtractJobStatus(
        ok=job.get("status") == "done",
        jobId=job_id,
        status=job.get("status", "unknown"),
        createdAt=job.get("createdAt", _utc_now_iso()),
        updatedAt=job.get("updatedAt", _utc_now_iso()),
        attempts=int(job.get("attempts") or 0),
        nextRetryAt=job.get("nextRetryAt"),
        result=result,
        error=job.get("error"),
    )


@app.get("/v1/extract/dlq")
async def extract_document_dlq(limit: int = 20, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _validate_api_key(authorization)
    if _queue_backend != "redis" or _redis is None:
        return {"ok": True, "backend": _queue_backend, "items": []}

    normalized_limit = max(1, min(100, int(limit)))
    raw_items = await _redis.lrange(REDIS_DLQ_KEY, -normalized_limit, -1)
    items = []
    for raw in raw_items:
        text = raw.decode("utf-8", errors="ignore") if isinstance(raw, bytes) else str(raw)
        try:
            items.append(json.loads(text))
        except Exception:
            continue
    return {"ok": True, "backend": _queue_backend, "items": items}

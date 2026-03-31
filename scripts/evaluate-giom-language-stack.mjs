import { mkdir, writeFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const REPORT_PATH = path.join("reports", "giom-language-stack-audit.json")

const LOCAL_FASTTEXT_CANDIDATES = [
  "models/fasttext/lid.176.ftz",
  "models/fasttext/lid.176.bin",
  "assets/models/fasttext/lid.176.ftz",
  "assets/models/fasttext/lid.176.bin"
]

function nowIso() {
  return new Date().toISOString()
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms)
}

async function runCheck(id, label, run) {
  const startedAt = Date.now()
  try {
    const details = await run()
    return {
      id,
      label,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      details
    }
  } catch (error) {
    return {
      id,
      label,
      status: "error",
      latencyMs: Date.now() - startedAt,
      error: error?.message || String(error)
    }
  }
}

async function checkDictionaryApi() {
  const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/example", {
    signal: timeoutSignal(8000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  return {
    endpoint: "https://api.dictionaryapi.dev/api/v2/entries/en/{word}",
    entries: Array.isArray(payload) ? payload.length : 0,
    sampleWord: payload?.[0]?.word || null
  }
}

async function checkDatamuse() {
  const response = await fetch("https://api.datamuse.com/words?ml=language&max=5", {
    signal: timeoutSignal(8000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  return {
    endpoint: "https://api.datamuse.com/words",
    suggestions: Array.isArray(payload) ? payload.map((item) => item.word).slice(0, 5) : []
  }
}

async function checkWiktionaryMediaWiki() {
  const api = "https://en.wiktionary.org/w/api.php?action=query&prop=extracts&format=json&titles=language&explaintext=1&redirects=1"
  const response = await fetch(api, {
    signal: timeoutSignal(10000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  const pages = payload?.query?.pages || {}
  const firstPage = Object.values(pages)[0]

  return {
    endpoint: "https://{wiki}/w/api.php",
    hasExtract: Boolean(firstPage?.extract),
    extractPreview: (firstPage?.extract || "").slice(0, 120)
  }
}

async function checkLanguageTool() {
  const body = new URLSearchParams({
    text: "I has a apple.",
    language: "en-US"
  })

  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    signal: timeoutSignal(12000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  return {
    endpoint: "https://api.languagetool.org/v2/check",
    matches: Array.isArray(payload?.matches) ? payload.matches.length : 0,
    detectedLanguage: payload?.language?.detectedLanguage?.name || null
  }
}

async function checkMyMemory() {
  const response = await fetch("https://api.mymemory.translated.net/get?q=ola&langpair=pt|en", {
    signal: timeoutSignal(10000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  return {
    endpoint: "https://api.mymemory.translated.net/get",
    translatedText: payload?.responseData?.translatedText || null,
    match: payload?.responseData?.match || null
  }
}

async function checkLibreTranslate() {
  const response = await fetch("https://libretranslate.com/languages", {
    signal: timeoutSignal(10000)
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = await response.json()
  return {
    endpoint: "https://libretranslate.com/languages",
    languagesCount: Array.isArray(payload) ? payload.length : 0,
    sample: Array.isArray(payload) ? payload.slice(0, 3) : []
  }
}

function checkLocalFastText() {
  const found = LOCAL_FASTTEXT_CANDIDATES.filter((candidate) => existsSync(candidate))

  if (found.length === 0) {
    throw new Error("Modelo fastText lid.176 nao encontrado nos caminhos padrao")
  }

  return {
    candidates: LOCAL_FASTTEXT_CANDIDATES,
    found
  }
}

function summarize(checks) {
  const total = checks.length
  const ok = checks.filter((check) => check.status === "ok").length
  const errors = checks.filter((check) => check.status === "error")

  return {
    totalChecks: total,
    okChecks: ok,
    failedChecks: errors.length,
    readinessPercent: Math.round((ok / total) * 100),
    failedServices: errors.map((error) => ({
      id: error.id,
      label: error.label,
      error: error.error
    }))
  }
}

async function main() {
  const checks = []

  checks.push(await runCheck("dictionary_api", "DictionaryAPI.dev", checkDictionaryApi))
  checks.push(await runCheck("datamuse", "Datamuse API", checkDatamuse))
  checks.push(await runCheck("wiktionary_mediawiki", "Wiktionary via MediaWiki", checkWiktionaryMediaWiki))
  checks.push(await runCheck("languagetool", "LanguageTool Public API", checkLanguageTool))
  checks.push(await runCheck("mymemory", "MyMemory Translation API", checkMyMemory))
  checks.push(await runCheck("libretranslate", "LibreTranslate Public", checkLibreTranslate))
  checks.push(await runCheck("fasttext_local", "fastText local model", async () => checkLocalFastText()))

  const report = {
    generatedAt: nowIso(),
    summary: summarize(checks),
    checks,
    recommendations: [
      "Ativar cache local para APIs publicas com TTL por idioma e termo.",
      "Self-host de LanguageTool e LibreTranslate se virarem caminho critico.",
      "Baixar e versionar fastText lid.176 para roteamento de idioma offline.",
      "Registrar fallback por servico para evitar falha total de pipeline."
    ]
  }

  await mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`AUDIT_OK ${path.resolve(REPORT_PATH)}`)
  console.log(`READINESS_PERCENT ${report.summary.readinessPercent}`)
  console.log(`FAILED_CHECKS ${report.summary.failedChecks}`)
}

main().catch((error) => {
  console.error(`AUDIT_FAIL ${error?.message || String(error)}`)
  process.exit(1)
})

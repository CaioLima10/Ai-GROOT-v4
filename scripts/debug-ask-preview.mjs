const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3011"
const askMode = process.env.ASK_MODE === "stream" ? "stream" : "ask"
const question = process.env.ASK_QUESTION || process.argv.slice(2).join(" ").trim() || "fale sobre escatologia"
const waitForUpMs = Number(process.env.WAIT_FOR_UP_MS || 0)

const endpoint = `${apiBaseUrl}/${askMode === "stream" ? "ask/stream" : "ask"}`
const payload = {
  question,
  context: {
    channel: "web-next",
    migrationStage: 4
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function summarizeJsonEnvelope(bodyText) {
  const parsed = safeJsonParse(bodyText)
  if (!parsed) {
    return {
      raw: bodyText.slice(0, 2000)
    }
  }

  return {
    answerPreview: String(parsed.response || parsed.answer || parsed.text || "").slice(0, 1200),
    metadata: parsed.metadata || null,
    tracePreview: Array.isArray(parsed.trace)
      ? parsed.trace.slice(0, 8).map((item) => ({
        type: item?.type || null,
        handler: item?.handler || null,
        intent: item?.intent || null
      }))
      : null
  }
}

function summarizeSseEnvelope(bodyText) {
  const events = []
  const chunks = bodyText
    .split(/\r?\n\r?\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  for (const chunk of chunks) {
    const eventMatch = chunk.match(/(?:^|\n)event:\s*([^\n]+)/)
    const dataMatch = chunk.match(/(?:^|\n)data:\s*([\s\S]+)/)
    if (!eventMatch || !dataMatch) {
      continue
    }

    const eventName = eventMatch[1].trim()
    const data = safeJsonParse(dataMatch[1].trim())

    if (eventName === "chunk") {
      continue
    }

    events.push({
      event: eventName,
      data
    })
  }

  return {
    events
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postWithRetry() {
  const startedAt = Date.now()
  let lastError = null

  while (true) {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "debug-preview-user"
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      lastError = error

      if (Date.now() - startedAt >= waitForUpMs) {
        throw lastError
      }

      await sleep(300)
    }
  }
}

const response = await postWithRetry()

const bodyText = await response.text()
const summary = askMode === "stream"
  ? summarizeSseEnvelope(bodyText)
  : summarizeJsonEnvelope(bodyText)

console.log(JSON.stringify({
  endpoint,
  status: response.status,
  question,
  summary
}, null, 2))

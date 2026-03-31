import fs from "node:fs/promises"
import path from "node:path"

const TRAINING_DIR = path.resolve(process.cwd(), "data", "training")

async function ensureTrainingDir() {
  await fs.mkdir(TRAINING_DIR, { recursive: true })
}

async function appendJsonLine(fileName, payload) {
  await ensureTrainingDir()
  const filePath = path.join(TRAINING_DIR, fileName)
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8")
  return filePath
}

export async function writeEvaluationDataset({ question, answer, evaluation, metadata = {} }) {
  const baseRecord = {
    ts: new Date().toISOString(),
    question: String(question || ""),
    answer: String(answer || ""),
    evaluation,
    metadata
  }

  const writes = []

  if ((evaluation?.score || 0) >= 0.8) {
    writes.push(appendJsonLine("good_responses.jsonl", baseRecord))
  } else if ((evaluation?.score || 0) < 0.5) {
    writes.push(appendJsonLine("bad_responses.jsonl", baseRecord))
  }

  if ((evaluation?.hallucinationRisk || 0) > 0.4) {
    writes.push(appendJsonLine("hallucinations.jsonl", baseRecord))
  }

  await Promise.all(writes)
  return writes.length
}

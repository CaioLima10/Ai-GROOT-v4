// Integração com YouVersion Platform API (Bible.com)
import axios from "axios"
import dotenv from "dotenv"
import { lookupLocalBiblePassage } from "./localBibleLibrary.js"

dotenv.config()

const BASE_URL = "https://api.youversion.com/v1"

function getAppKey() {
  return process.env.YVP_APP_KEY
}

function normalizeBibleCode(code) {
  if (!code) return ""
  return String(code).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")
}

function resolveBibleId({ bibleId, bibleCode }) {
  if (bibleId) return bibleId
  const normalized = normalizeBibleCode(bibleCode)
  if (normalized) {
    const envKey = `YVP_BIBLE_ID_${normalized}`
    if (process.env[envKey]) {
      return process.env[envKey]
    }
  }
  return process.env.YVP_BIBLE_ID || "3034"
}

export async function fetchBiblePassage({ bibleId, bibleCode, passage }) {
  if (!passage) {
    throw new Error("Passagem não informada")
  }

  const localPassage = await lookupLocalBiblePassage({
    passage,
    bibleCode
  }).catch(() => null)

  if (localPassage) {
    return localPassage
  }

  const appKey = getAppKey()
  if (!appKey) {
    throw new Error("YVP_APP_KEY nao configurada e a biblioteca biblica local nao conseguiu resolver a passagem.")
  }

  const resolvedBibleId = resolveBibleId({ bibleId, bibleCode })
  const url = `${BASE_URL}/bibles/${encodeURIComponent(resolvedBibleId)}/passages/${encodeURIComponent(passage)}`

  const response = await axios.get(url, {
    headers: {
      "X-YVP-App-Key": appKey
    },
    timeout: 15000
  })

  return {
    provider: "youversion",
    source: "youversion",
    ...response.data
  }
}

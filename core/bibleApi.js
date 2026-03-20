// Integração com YouVersion Platform API (Bible.com)
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const BASE_URL = "https://api.youversion.com/v1"

function getAppKey() {
  return process.env.YVP_APP_KEY
}

export async function fetchBiblePassage({ bibleId, passage }) {
  const appKey = getAppKey()
  if (!appKey) {
    throw new Error("YVP_APP_KEY não configurada")
  }

  if (!passage) {
    throw new Error("Passagem não informada")
  }

  const resolvedBibleId = bibleId || process.env.YVP_BIBLE_ID || "3034"
  const url = `${BASE_URL}/bibles/${encodeURIComponent(resolvedBibleId)}/passages/${encodeURIComponent(passage)}`

  const response = await axios.get(url, {
    headers: {
      "X-YVP-App-Key": appKey
    },
    timeout: 15000
  })

  return response.data
}

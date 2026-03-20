import dotenv from "dotenv"

dotenv.config()

const apiKey = process.env.YVP_APP_KEY
if (!apiKey) {
  console.error("❌ YVP_APP_KEY não configurada. Defina no .env ou no ambiente.")
  process.exit(1)
}

const args = process.argv.slice(2)
const langsArg = args.find(arg => arg.startsWith("--langs="))
const outArg = args.find(arg => arg.startsWith("--out="))

const langs = (langsArg ? langsArg.split("=")[1] : "pt,en,pt-BR")
  .split(",")
  .map(lang => lang.trim())
  .filter(Boolean)

const outFile = outArg ? outArg.split("=")[1] : "bibles-filtered.json"

const params = new URLSearchParams()
langs.forEach(lang => params.append("language_ranges[]", lang))

const url = `https://api.youversion.com/v1/bibles?${params.toString()}`

async function run() {
  const response = await fetch(url, {
    headers: { "X-YVP-App-Key": apiKey }
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`❌ Erro HTTP ${response.status}: ${text}`)
    process.exit(1)
  }

  const payload = await response.json()
  const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : [])

  if (data.length === 0) {
    console.log("⚠️ Nenhuma biblia retornada. Verifique idiomas ou permissoes.")
    process.exit(0)
  }

  const regex = new RegExp(
    "NAA|ARC|ARA|KJV|1611|GREEK|HEBREW|ALMEIDA|CORRIGIDA|ATUALIZADA|KING JAMES|GREGO|HEBRA",
    "i"
  )

  const filtered = data.filter(item => regex.test(JSON.stringify(item)))

  const preview = filtered.map(item => ({
    id: item.id,
    abbreviation: item.abbreviation,
    name: item.name,
    language: item.language,
    language_name: item.language_name
  }))

  console.log(`✅ Total retornadas: ${data.length}`)
  console.log(`✅ Filtradas: ${filtered.length}`)
  console.log(`📄 Campos: ${Object.keys(data[0] || {}).join(", ")}`)
  console.table(preview)

  await import("fs/promises").then(fs =>
    fs.writeFile(outFile, JSON.stringify(preview, null, 2), "utf8")
  )

  console.log(`💾 Salvo em ${outFile}`)
}

run().catch(error => {
  console.error("❌ Falha ao consultar YouVersion:", error.message)
  process.exit(1)
})

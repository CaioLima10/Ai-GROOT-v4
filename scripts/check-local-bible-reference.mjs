import { lookupLocalBiblePassage } from "../core/localBibleLibrary.js"

const passage = String(process.argv[2] || "").trim()
const bibleCode = String(process.argv[3] || "NAA").trim()

if (!passage) {
  console.error("Uso: node scripts/check-local-bible-reference.mjs <passagem> [bibleCode]")
  process.exit(1)
}

const result = await lookupLocalBiblePassage({
  passage,
  bibleCode
})

if (!result) {
  console.error("Passagem nao encontrada na biblioteca local.")
  process.exit(2)
}

console.log(JSON.stringify({
  source: result.source,
  reference: result.reference,
  bibleCode: result.bibleCode,
  truncated: result.truncated,
  totalVerses: result.totalVerses,
  content: result.content
}, null, 2))

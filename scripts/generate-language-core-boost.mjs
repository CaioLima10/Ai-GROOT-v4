import fs from "fs/promises"
import path from "path"

const OUT_DIR = path.join(process.cwd(), "knowledge", "docs", "language-core-boost")

function parseArgs() {
  const args = process.argv.slice(2)
  let count = 650
  const countIdx = args.indexOf("--count")
  if (countIdx >= 0 && args[countIdx + 1]) {
    count = Math.max(1, Number(args[countIdx + 1]) || count)
  }
  return { count }
}

function buildDoc(index) {
  const title = `Language Core Boost ${String(index + 1).padStart(4, "0")}`
  const slug = `language-core-boost-${String(index + 1).padStart(4, "0")}`

  const body = [
    "---",
    `title: ${title}`,
    "category: language",
    "language: pt",
    "source: local.generated.language",
    "rights: user_generated_internal",
    "modules: language,reasoning,communication",
    "---",
    "",
    `# ${title}`,
    "",
    "## Compreensao textual",
    "Interpretar texto exige identificar tema, intencao, contexto, pressupostos e limites da afirmacao.",
    "",
    "## Logica e resposta",
    "A resposta deve ter premissas claras, inferencia valida e conclusao verificavel.",
    "",
    "## Conversa humana online",
    "Adaptar tom para internet: ser objetivo, educado, empatico e util, incluindo emojis quando ajudarem o entendimento.",
    "",
    "## Exemplo pratico",
    "Quando o usuario pede ajuda rapida, responder com resumo, passos, alerta de risco e proxima acao recomendada.",
    "",
    "## Regra de qualidade",
    "Evitar ambiguidade, explicitar incerteza e separar fato de opiniao.",
    ""
  ].join("\n")

  return { fileName: `${slug}.md`, content: body }
}

async function main() {
  const { count } = parseArgs()
  await fs.mkdir(OUT_DIR, { recursive: true })

  for (let i = 0; i < count; i += 1) {
    const doc = buildDoc(i)
    await fs.writeFile(path.join(OUT_DIR, doc.fileName), doc.content, "utf8")
  }

  console.log(`BOOST_OK ${OUT_DIR}`)
  console.log(`BOOST_DOCS ${count}`)
}

main().catch((error) => {
  console.error(`BOOST_ERROR ${error.message}`)
  process.exit(1)
})

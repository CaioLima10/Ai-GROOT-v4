import fs from "fs/promises"
import path from "path"

const DEFAULT_OUT_DIR = path.join(process.cwd(), "knowledge", "docs", "language-conversation-pack")
const DEFAULT_COUNT = 1200

const domains = [
  "interpretacao_textual",
  "comunicacao_internet",
  "logica_argumentacao",
  "matematica_aplicada",
  "fisica_base",
  "biologia_base",
  "quimica_base",
  "agro_tecnologia",
  "dev_documentation",
  "ia_projetos"
]

const tones = [
  "didatico",
  "pratico",
  "analitico",
  "acolhedor",
  "direto"
]

const emojiSets = [
  "🙂🤝📚",
  "🚀🧠💡",
  "✅📌🛠️",
  "🌱📈🔍",
  "⚙️🧪🧩"
]

function parseArgs() {
  const args = process.argv.slice(2)
  const config = {
    outDir: DEFAULT_OUT_DIR,
    count: DEFAULT_COUNT
  }

  const outIdx = args.indexOf("--out-dir")
  if (outIdx >= 0 && args[outIdx + 1]) {
    config.outDir = path.resolve(process.cwd(), args[outIdx + 1])
  }

  const countIdx = args.indexOf("--count")
  if (countIdx >= 0 && args[countIdx + 1]) {
    config.count = Math.max(1, Number(args[countIdx + 1]) || DEFAULT_COUNT)
  }

  return config
}

function buildDoc(index) {
  const domain = domains[index % domains.length]
  const tone = tones[index % tones.length]
  const emojis = emojiSets[index % emojiSets.length]
  const level = (index % 5) + 1

  const title = `Pack ${String(index + 1).padStart(4, "0")} - ${domain} - nivel ${level}`
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  const content = [
    "---",
    `title: ${title}`,
    `category: ${domain}`,
    "language: pt",
    "source: local.generated",
    "rights: user_generated_internal",
    "modules: language,reasoning,communication",
    "---",
    "",
    `# ${title}`,
    "",
    "## Objetivo",
    `Treinar a IA em ${domain} com foco em clareza, consistencia e utilidade real para usuarios humanos.`,
    "",
    "## Regra de resposta",
    `Tom ${tone}. Estruture em contexto, passo a passo e verificacao final. Evite respostas vagas.`,
    "",
    "## Conversacao real de internet",
    `Mensagem do usuario: \"to com duvida nisso, me ajuda rapido?\" ${emojis}`,
    "Resposta esperada: acolher, resumir o problema e oferecer um caminho objetivo com exemplos praticos.",
    "",
    "## Compreensao e interpretacao",
    "1. Identificar intencao principal e intencao secundaria.",
    "2. Detectar ambiguidades e pedir confirmacao minima quando necessario.",
    "3. Explicar usando linguagem simples e depois opcao avancada.",
    "",
    "## Logica",
    "- Premissa: toda resposta precisa ser verificavel.",
    "- Inferencia: se faltam dados, sinalizar limite e propor teste.",
    "- Conclusao: recomendar a melhor acao imediata com risco baixo.",
    "",
    "## Exemplo tecnico",
    "Ao explicar OCR/PDF/documentos, detalhar pipeline: entrada -> extracao -> limpeza -> indexacao -> busca semantica.",
    "",
    "## Qualidade",
    "Use criterio de qualidade: precisao factual, utilidade pratica, seguranca e transparencia sobre incertezas.",
    ""
  ].join("\n")

  return {
    fileName: `${slug}.md`,
    content
  }
}

async function main() {
  const config = parseArgs()
  await fs.mkdir(config.outDir, { recursive: true })

  for (let i = 0; i < config.count; i += 1) {
    const doc = buildDoc(i)
    await fs.writeFile(path.join(config.outDir, doc.fileName), doc.content, "utf8")
  }

  console.log(`PACK_OK ${config.outDir}`)
  console.log(`DOCS_GENERATED ${config.count}`)
}

main().catch((error) => {
  console.error(`PACK_ERROR ${error.message}`)
  process.exit(1)
})

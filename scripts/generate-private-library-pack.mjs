import fs from "fs/promises"
import fsSync from "fs"
import path from "path"
import PDFDocument from "pdfkit"

const BASE_DIR = path.join(process.cwd(), "knowledge", "docs", "private-library-pack")
const DOCUMENTS_DIR = path.join(BASE_DIR, "documents")
const ARTICLES_DIR = path.join(BASE_DIR, "articles")
const PDFS_DIR = path.join(BASE_DIR, "pdfs")

const THEMES = [
  {
    id: "native_languages_and_slang",
    title: "Native languages, slang, dialects, internet abbreviations and emojis",
    tags: ["linguistics", "slang", "dialects", "emoji", "internet_language"],
    keywords: ["native language", "slang", "dialect", "internet abbreviation", "emoji", "conversation"]
  },
  {
    id: "christian_jewish_hebraic_archaeology",
    title: "Christian, Jewish and Hebraic archaeology",
    tags: ["archaeology", "history", "ancient_near_east", "bible"],
    keywords: ["archaeology", "inscription", "manuscript", "excavation", "historical context"]
  },
  {
    id: "protestant_books_and_authors",
    title: "Protestant books, theologians and authors",
    tags: ["protestant", "books", "theology", "church_history"],
    keywords: ["protestant theology", "author", "book", "doctrine", "sermon"]
  },
  {
    id: "protestant_preachers_classic_modern",
    title: "Classic and modern Protestant preachers",
    tags: ["preaching", "homiletics", "church"],
    keywords: ["preacher", "homiletics", "sermon craft", "pastoral communication"]
  },
  {
    id: "protestant_devotionals_and_christian_life",
    title: "Devotionals and Christian life",
    tags: ["devotional", "discipleship", "prayer", "christian_life"],
    keywords: ["devotional", "discipleship", "daily practice", "prayer", "spiritual growth"]
  },
  {
    id: "christian_science_dialogue",
    title: "Christian worldview and science dialogue",
    tags: ["science", "apologetics", "philosophy"],
    keywords: ["science", "worldview", "epistemology", "faith and reason", "critical thinking"]
  },
  {
    id: "stem_and_languages_bundle",
    title: "Biology, chemistry, physics, mathematics, Portuguese, English, Hebrew, Aramaic, Latin, Greek",
    tags: ["biology", "chemistry", "physics", "math", "portuguese", "english", "hebrew", "aramaic", "latin", "greek"],
    keywords: ["biology", "chemistry", "physics", "mathematics", "grammar", "translation", "hebrew", "greek"]
  },
  {
    id: "logic_games_training",
    title: "Chess, dominoes, tic-tac-toe, sudoku, minesweeper, Rubik cube",
    tags: ["games", "logic", "strategy", "problem_solving"],
    keywords: ["chess", "domino", "tic tac toe", "sudoku", "minesweeper", "rubik cube"]
  },
  {
    id: "eschatology_tribulation_views",
    title: "Eschatology and pre/mid/post tribulation views",
    tags: ["eschatology", "systematic_theology", "doctrinal_studies"],
    keywords: ["eschatology", "tribulation", "premillennial", "amillennial", "postmillennial"]
  },
  {
    id: "church_fathers_and_patristics",
    title: "Church fathers and patristics",
    tags: ["church_fathers", "patristics", "history"],
    keywords: ["church father", "patristics", "historical theology", "early church"]
  },
  {
    id: "pentecostal_testimonies_and_practice",
    title: "Pentecostal testimonies and practical ministry",
    tags: ["pentecostal", "testimony", "pastoral"],
    keywords: ["testimony", "pentecostal", "pastoral care", "practical ministry"]
  },
  {
    id: "christian_women_and_children",
    title: "Christian women and Christian children discipleship",
    tags: ["women", "children", "discipleship", "family"],
    keywords: ["christian woman", "family discipleship", "child education", "biblical formation"]
  },
  {
    id: "christian_thinkers_and_books",
    title: "Christian thinkers and their books",
    tags: ["thinkers", "books", "intellectual_history"],
    keywords: ["christian thinker", "book summary", "intellectual history", "ideas"]
  },
  {
    id: "astronomy_satellites_gps",
    title: "Astronomy, satellites and GPS",
    tags: ["astronomy", "satellite", "gps", "space_science"],
    keywords: ["astronomy", "satellite", "gps", "orbit", "positioning systems"]
  },
  {
    id: "angiology_foundations",
    title: "Angiology foundations and study support",
    tags: ["medicine", "angiology", "health_education"],
    keywords: ["angiology", "vascular system", "clinical basics", "health literacy"]
  }
]

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function nowIsoDay() {
  return new Date().toISOString().slice(0, 10)
}

async function ensureDirs() {
  await fs.mkdir(DOCUMENTS_DIR, { recursive: true })
  await fs.mkdir(ARTICLES_DIR, { recursive: true })
  await fs.mkdir(PDFS_DIR, { recursive: true })
}

function buildDocumentContent(theme, index) {
  const focus = theme.keywords[index % theme.keywords.length]
  const tagLine = theme.tags.join(", ")

  return `---\ntitle: GIOM Study Document ${String(index).padStart(3, "0")} - ${theme.title}\nsource: https://internal.local/giom/private-library-pack/document-${String(index).padStart(3, "0")}\nlicense: internal\ncategory: private_library\ncategories: private_library, ${theme.tags.join(", ")}\nmodules: research, language_learning, theological_studies\nupdatedAt: ${nowIsoDay()}\n---\n\n# ${theme.title}\n\n## Core objective\nBuild fluent comprehension, interpretation and conversation quality for the GIOM assistant in the domain of ${theme.title}.\n\n## Key vocabulary\n- Focus term: ${focus}\n- Domain tags: ${tagLine}\n- Practical register: formal explanation, casual dialogue, teaching mode and question-answer mode\n\n## Text comprehension protocol\n1. Identify intent and context before answering.\n2. Resolve ambiguous words by nearby context.\n3. Detect if the user asks for definition, comparison, summary or application.\n4. Respond with layered depth: short, medium, deep.\n\n## Interpretation protocol\n- Distinguish fact, interpretation and hypothesis.\n- Keep historical and doctrinal claims traceable to explicit evidence.\n- When uncertainty exists, declare uncertainty and propose verification steps.\n\n## Conversation protocol\n- Keep language natural, direct and practical.\n- Support Portuguese and English response style adaptation.\n- For ancient-language content, provide transliteration and plain-language paraphrase.\n- For educational requests, propose examples and exercises.\n\n## Applied mini-corpus\nParagraph A: In this topic, precise language is required so the assistant avoids shallow answers and handles real-world questions with clarity.\n\nParagraph B: A fluent assistant combines vocabulary control, contextual reasoning and response shaping for beginner, intermediate and advanced users.\n\nParagraph C: Reliable output depends on structured interpretation rules, not only on keyword matches, so each answer remains coherent and safe.\n\n## Quality checklist\n- Is the answer contextualized?\n- Is the claim verifiable?\n- Is the response useful for the exact user intent?\n- Is there a better simpler explanation for beginners?\n\n## Practice prompts\n- Explain ${focus} for a beginner and then for an advanced learner.\n- Compare two interpretations of the same paragraph in this theme.\n- Produce a short teaching outline with examples and exercises.\n`
}

function buildArticleContent(theme, index) {
  return `---\ntitle: GIOM Thematic Article ${String(index).padStart(2, "0")} - ${theme.title}\nsource: https://internal.local/giom/private-library-pack/article-${String(index).padStart(2, "0")}\nlicense: internal\ncategory: private_library\ncategories: private_library, article, ${theme.tags.join(", ")}\nmodules: research, interpretation, conversation_design\nupdatedAt: ${nowIsoDay()}\n---\n\n# ${theme.title}: advanced synthesis article\n\n## Why this article matters\nThis article was generated to reinforce GIOM fluency in comprehension, interpretation and dialog quality for ${theme.title}.\n\n## Analytical frame\nA robust response model needs lexical precision, contextual disambiguation and audience adaptation. The assistant should identify whether the user needs a concise practical answer, a didactic explanation or a deep analytical review.\n\n## Knowledge integration\nThe assistant should integrate thematic vocabulary, historical context, methodological caution and practical application. This prevents shallow or overconfident output and supports reliable educational use.\n\n## Interpretation pitfalls\nCommon failures include anachronism, over-generalization, unsupported certainty and fragmented logic. The correct strategy is to present evidence, state limits and provide clear next verification steps.\n\n## Conversation architecture\n1. Confirm intent quickly.\n2. Deliver a direct answer.\n3. Add structured expansion options.\n4. Offer practical examples and follow-up prompts.\n\n## Applied conclusion\nWhen GIOM uses this framework, it becomes more fluent, more coherent and more useful in long conversations that require nuanced interpretation and practical guidance.\n`
}

function buildPdfSections(theme, index) {
  return [
    `GIOM PDF Knowledge Pack ${String(index).padStart(2, "0")}`,
    `Theme: ${theme.title}`,
    "",
    "Purpose:",
    `Create high-quality support content for comprehension, interpretation and fluent conversation in ${theme.title}.`,
    "",
    "Core modules:",
    "- lexical mapping",
    "- context disambiguation",
    "- response style adaptation",
    "- educational scaffolding",
    "- verification-aware reasoning",
    "",
    "Conversation blueprint:",
    "1) detect user intent",
    "2) answer directly",
    "3) clarify assumptions",
    "4) provide examples",
    "5) offer follow-up paths",
    "",
    "Interpretation safeguards:",
    "- separate evidence from inference",
    "- avoid fabricated certainty",
    "- mark uncertainty explicitly",
    "- suggest practical verification",
    "",
    "Mini glossary:",
    `- ${theme.keywords.join("\n- ")}`,
    "",
    "Final note:",
    "This document is part of an internal generated library pack for GIOM runtime learning support."
  ]
}

async function writePdf(filePath, lines) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const stream = doc.pipe(fsSync.createWriteStream(filePath))

    doc.fontSize(12)
    for (const line of lines) {
      if (!line) {
        doc.moveDown(0.6)
      } else {
        doc.text(line, { lineGap: 4 })
      }
    }

    doc.end()
    stream.on("finish", resolve)
    stream.on("error", reject)
  })
}

async function main() {
  await ensureDirs()

  const documentWrites = []
  for (let index = 1; index <= 100; index += 1) {
    const theme = THEMES[(index - 1) % THEMES.length]
    const fileName = `doc-${String(index).padStart(3, "0")}-${slugify(theme.id)}.md`
    const filePath = path.join(DOCUMENTS_DIR, fileName)
    documentWrites.push(fs.writeFile(filePath, buildDocumentContent(theme, index), "utf8"))
  }

  const articleWrites = []
  for (let index = 1; index <= 20; index += 1) {
    const theme = THEMES[(index + 4) % THEMES.length]
    const fileName = `article-${String(index).padStart(2, "0")}-${slugify(theme.id)}.md`
    const filePath = path.join(ARTICLES_DIR, fileName)
    articleWrites.push(fs.writeFile(filePath, buildArticleContent(theme, index), "utf8"))
  }

  await Promise.all([...documentWrites, ...articleWrites])

  for (let index = 1; index <= 20; index += 1) {
    const theme = THEMES[(index + 8) % THEMES.length]
    const fileName = `pdf-${String(index).padStart(2, "0")}-${slugify(theme.id)}.pdf`
    const filePath = path.join(PDFS_DIR, fileName)
    await writePdf(filePath, buildPdfSections(theme, index))
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    documents: 100,
    articles: 20,
    pdfs: 20,
    baseDir: BASE_DIR,
    themes: THEMES.map(theme => ({ id: theme.id, title: theme.title }))
  }

  await fs.writeFile(path.join(BASE_DIR, "PACK-SUMMARY.json"), JSON.stringify(summary, null, 2), "utf8")
  await fs.writeFile(
    path.join(BASE_DIR, "README.md"),
    [
      "# GIOM Private Library Pack",
      "",
      "Generated internal pack for language fluency, interpretation and domain knowledge support.",
      "",
      "Counts:",
      "- 100 documents in ./documents",
      "- 20 articles in ./articles",
      "- 20 PDFs in ./pdfs",
      "",
      "Use ingestion:",
      "npm run knowledge:private-library -- --dir knowledge/docs/private-library-pack --topics-file knowledge/docs/private-library-topics.json --rights user_provided_or_public_domain --index-mode full"
    ].join("\n"),
    "utf8"
  )

  console.log("PACK_GENERATED")
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error("PACK_GENERATION_FAILED", error)
  process.exit(1)
})

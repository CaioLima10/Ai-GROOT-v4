/**
 * Generate deep biblical knowledge using OpenAI and ingest into Supabase.
 *
 * Uses the OPENAI_API_KEY exclusively for building a comprehensive
 * biblical knowledge base — NOT for TTS.
 *
 * Usage:
 *   node scripts/generate-bible-knowledge.mjs                  # full run
 *   node scripts/generate-bible-knowledge.mjs --dry-run        # preview only
 *   node scripts/generate-bible-knowledge.mjs --topic "Salmos" # single topic
 */

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(__dirname, "..", "knowledge", "curated")

// Provider resolution: Groq (free) > Gemini (free) > OpenAI (paid fallback)
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim()
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim()
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim()

function resolveProvider() {
  // Try Groq first (free), then Gemini (free), then OpenAI (paid)
  if (GROQ_API_KEY && !GROQ_API_KEY.includes("dummy")) {
    return {
      name: "groq",
      model: "llama-3.3-70b-versatile",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: GROQ_API_KEY,
      rateDelayMs: 65_000, // Groq free: 12K TPM — wait 65s between requests
      maxTokens: 3500
    }
  }
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes("dummy") && !GEMINI_API_KEY.includes("Dummy")) {
    return {
      name: "gemini",
      model: "gemini-2.5-flash",
      url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      key: GEMINI_API_KEY,
      rateDelayMs: 4_000,
      maxTokens: 8192
    }
  }
  if (OPENAI_API_KEY) {
    return {
      name: "openai",
      model: String(process.env.OPENAI_MODEL || "gpt-4o-mini").trim(),
      url: "https://api.openai.com/v1/chat/completions",
      key: OPENAI_API_KEY,
      rateDelayMs: 3_000,
      maxTokens: 4096
    }
  }
  return null
}

const PROVIDER = resolveProvider()
if (!PROVIDER) {
  console.error("❌ Nenhuma API key configurada (GROQ_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY)")
  process.exit(1)
}
console.log(`🔑 Usando provider: ${PROVIDER.name} (${PROVIDER.model})`)

// ---------------------------------------------------------------------------
// Biblical topics to generate deep knowledge about
// ---------------------------------------------------------------------------

const BIBLE_TOPICS = [
  {
    id: "bible-pentateuch-deep",
    title: "Pentateuco: Genesis, Exodo, Levitico, Numeros, Deuteronomio",
    prompt: `Gere um guia academico e pastoral detalhado sobre o Pentateuco (Torah):
- Autoria mosaica e debate academico moderno
- Estrutura literaria de cada livro (Genesis a Deuteronomio)
- Temas teologicos centrais: criacao, queda, alianca, exodo, lei, terra prometida
- Tipologia crista no Pentateuco (sacrificios, cordeiro, sacerdocio)
- Contexto historico e arqueologico (Antigo Oriente Proximo)
- Generos literarios: narrativa, lei, poesia, genealogia
- Aplicacao pastoral e devocional para cada livro`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,biblical_history,devotional_practice"
  },
  {
    id: "bible-prophets-major",
    title: "Profetas Maiores: Isaias, Jeremias, Ezequiel, Daniel",
    prompt: `Gere conteudo academico detalhado sobre os Profetas Maiores:
- Contexto historico de cada profeta (periodo, reino, ameaca)
- Estrutura literaria e divisoes de cada livro
- Profecias messianicas em Isaias (servo sofredor, Emanuel, capitulos 40-66)
- Lamentacoes e sofrimento profético em Jeremias
- Visoes apocalipticas em Ezequiel e Daniel
- Cumprimento no Novo Testamento
- Termos-chave em hebraico: nabi, massa, chazon, dabar YHWH
- Aplicacao pastoral: justica social, arrependimento, esperanca`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "biblical_history,systematic_theology,original_languages"
  },
  {
    id: "bible-prophets-minor",
    title: "Profetas Menores: Os Doze (Oseias a Malaquias)",
    prompt: `Gere guia detalhado sobre os 12 Profetas Menores:
- Contexto historico de cada profeta
- Mensagem central de cada livro: Oseias (amor fiel), Joel (dia do Senhor), Amos (justica), Obadias (juizo sobre Edom), Jonas (misericordia), Miqueias (justica e misericordia), Naum (juizo), Habacuque (fe), Sofonias (remanescente), Ageu (reconstrucao), Zacarias (messias), Malaquias (fidelidade)
- Profecias messianicas nos profetas menores
- Termos teologicos centrais
- Aplicacao pastoral moderna`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "biblical_history,systematic_theology,devotional_practice"
  },
  {
    id: "bible-wisdom-literature",
    title: "Literatura Sapiencial: Jo, Salmos, Proverbios, Eclesiastes, Canticos",
    prompt: `Gere conteudo sobre a literatura de sabedoria biblica:
- Genero sapiencial no Antigo Oriente Proximo
- Jo: teodiceia, sofrimento do justo, discursos, resposta de Deus
- Salmos: tipos (louvor, lamento, real, sapiencial, imprecatorio), estrutura do saltério, uso liturgico
- Proverbios: sabedoria pratica, temor do Senhor, mulher virtuosa
- Eclesiastes: vaidade (hevel), busca de sentido, conclusao
- Cantico dos Canticos: interpretacao literal vs alegorica
- Termos hebraicos: chokmah, mashal, hevel, tehillim, mizmor
- Uso pastoral: aconselhamento, adoracao, ensino`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,devotional_practice,original_languages"
  },
  {
    id: "bible-gospels-synoptic",
    title: "Evangelhos Sinóticos: Mateus, Marcos, Lucas",
    prompt: `Gere guia academico sobre os Evangelhos Sinóticos:
- Problema sinótico: hipotese das duas fontes, fonte Q, prioridade marcana
- Teologia de cada evangelista: Mateus (Jesus como rei/mestre), Marcos (servo sofredor), Lucas (Salvador universal)
- Parabolas unicas e compartilhadas
- Narrativa da paixao em cada evangelio
- Sermão do Monte (Mateus 5-7) vs Sermão da Planicie (Lucas 6)
- Contexto historico: Palestina do seculo I, judaismo do Segundo Templo
- Termos gregos: euangelion, basileia, metanoia, pistis
- Aplicacao para pregacao e estudo biblico`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,biblical_history,original_languages,homiletics_preaching"
  },
  {
    id: "bible-johannine-literature",
    title: "Literatura Joanina: Evangelho, Epistolas e Apocalipse",
    prompt: `Gere conteudo detalhado sobre os escritos de Joao:
- Evangelho de Joao: prologo (Logos), sinais, discursos "Eu Sou", narrativa da paixao
- Diferença entre Joao e os Sinóticos
- 1, 2, 3 Joao: comunhão, verdade, amor, anticristo
- Apocalipse: genero apocaliptico, estrutura, simbolismo numerico, sete igrejas
- Escatologia: premilenarismo, amilenarismo, pos-milenarismo
- Termos gregos: logos, zoe, aletheia, agape, apokalypsis
- Contexto historico: comunidade joanina, perseguição romana
- Aplicacao pastoral e devocional`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,biblical_history,original_languages,eschatology"
  },
  {
    id: "bible-pauline-theology",
    title: "Teologia Paulina e Epístolas",
    prompt: `Gere conteudo aprofundado sobre Paulo e suas epistolas:
- Vida de Paulo: conversão, viagens missionarias, prisão
- Epistolas por grupo: proto-paulinas, deutero-paulinas, pastorais (debate academico)
- Teologia central: justificacao pela fe, lei e graca, corpo de Cristo, eclesiologia
- Romanos: estrutura e argumento teologico completo
- 1 e 2 Corintios: problemas pastorais, ressurreicao, ministerio
- Galatas: liberdade crista vs legalismo
- Efesios e Colossenses: cristologia cosmica
- Filipenses: kenosis e alegria
- 1 e 2 Tessalonicenses: escatologia paulina
- Pastorais: lideranca eclesiastica
- Termos gregos: dikaiosyne, charis, pistis, sarx, pneuma, ekklesia
- Aplicacao pastoral e pregacao`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,biblical_history,original_languages,homiletics_preaching"
  },
  {
    id: "bible-hebrews-general-epistles",
    title: "Hebreus e Epistolas Gerais: Tiago, Pedro, Judas",
    prompt: `Gere conteudo sobre Hebreus e as Epistolas Gerais:
- Hebreus: autoria, superioridade de Cristo, sacerdocio de Melquisedeque, alianca, fe (cap. 11)
- Tiago: fe e obras, sabedoria pratica, lingua
- 1 Pedro: sofrimento cristão, identidade do povo de Deus
- 2 Pedro: falsos mestres, escatologia
- Judas: contenda pela fe, apostasia
- Relacao entre Hebreus e o sistema sacrificial do AT
- Termos gregos: archiereus, diatheke, hypostasis, parousia
- Aplicacao pastoral: perseveranca, fe pratica`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,devotional_practice,original_languages"
  },
  {
    id: "bible-hermeneutics-methods",
    title: "Hermenêutica Bíblica: Métodos de Interpretação",
    prompt: `Gere guia completo sobre hermeneutica biblica:
- Principios fundamentais: contexto historico, literario, gramatical
- Metodo historico-gramatical vs historico-critico
- Generos literarios: narrativa, lei, poesia, profecia, apocaliptica, epistola, parabola
- Tipologia e alegoria: uso legitimo vs abuso
- Analogia da fe e analogia da Escritura
- Novo Testamento no Antigo: citações, alusões, cumprimento
- Linguagem figurada: metafora, hiperbole, ironia, metonimia
- Contexto cultural do Antigo Oriente Proximo e mundo greco-romano
- Ferramentas: léxicos, concordâncias, comentários
- Erros hermenêuticos comuns e como evitá-los
- Aplicação: do texto antigo ao contexto moderno`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,original_languages"
  },
  {
    id: "bible-biblical-theology-themes",
    title: "Teologia Bíblica: Temas Transversais",
    prompt: `Gere conteudo sobre os grandes temas teologicos que percorrem toda a Biblia:
- Reino de Deus: promessa, inauguração, consumação
- Aliança: noética, abraâmica, mosaica, davidica, nova aliança
- Templo e presença de Deus: Eden → Tabernáculo → Templo → Cristo → Igreja → Nova Jerusalém
- Sacrifício e expiação: sistema levítico → Cruz
- Povo de Deus: Israel → Igreja → humanidade redimida
- Lei e graça: continuidade e descontinuidade
- Criação e nova criação: Gênesis 1-2 → Apocalipse 21-22
- Messias: promessa e cumprimento
- Espírito Santo: AT (ruach) → NT (pneuma)
- Missão: Abraão → Grande Comissão → Atos → presente
- Justiça e misericórdia ao longo da Escritura`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology,biblical_history"
  },
  {
    id: "bible-original-languages-advanced",
    title: "Línguas Originais: Hebraico, Aramaico e Grego Avançado",
    prompt: `Gere conteudo avançado sobre as linguas originais da Biblia:
- Hebraico biblico: sistema verbal (qal, niphal, piel, pual, hiphil, hophal, hithpael), constructo, particulas
- Vocabulário teológico hebraico essencial: YHWH, elohim, chesed, emeth, shalom, tsedaqah, berith, torah, ruach, nephesh, kabod
- Aramaico bíblico: seções em Daniel e Esdras, particularidades
- Grego koiné: sistema de casos, tempo verbal (aspecto), voz média, particípios
- Vocabulário grego essencial: logos, agape, pistis, dikaiosyne, charis, sarx, pneuma, sozo, basileia, ekklesia, parousia
- Diferenças entre LXX e texto massorético
- Textual criticism basics: manuscritos, famílias textuais, aparato crítico
- Ferramentas gratuitas para estudo: Blue Letter Bible, Step Bible, interlinear
- Como usar léxicos (BDB, HALOT, BDAG, Thayer) e concordâncias (Strong)`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "original_languages,systematic_theology"
  },
  {
    id: "bible-archaeology-advanced",
    title: "Arqueologia Bíblica e Contexto Histórico Avançado",
    prompt: `Gere conteudo detalhado sobre arqueologia e historia biblica:
- Períodos arqueológicos relevantes: Bronze Antigo a Período Romano
- Descobertas que confirmam o texto bíblico: estela de Merneptá, inscrição de Tel Dan, cilindro de Ciro, óstraca de Laquis
- Mar Morto: manuscritos de Qumran, sua importância textual
- Cidades bíblicas escavadas: Jericó, Hazor, Megido, Jerusalém, Laquis, Beersheba
- Civilizações vizinhas: Egito, Mesopotâmia, Assíria, Babilônia, Pérsia, Grécia, Roma
- Vida cotidiana nos tempos bíblicos: casa, família, agricultura, comércio
- Cronologia bíblica: patriarcas, êxodo (debate de data), monarquia, exílio
- Método arqueológico: estratigrafia, tipologia cerâmica, datação
- Mapas: rotas do êxodo, viagens de Paulo, divisão tribal`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "biblical_history,biblical_archaeology"
  },
  {
    id: "bible-church-history-reformation",
    title: "História da Igreja e Reforma Protestante",
    prompt: `Gere conteudo sobre historia da igreja com foco protestante:
- Igreja primitiva: pais apostolicos, apologetas, concilios ecumenicos
- Pais da Igreja: Agostinho, Atanasio, Crisostomo, Irineu, Tertuliano
- Credos historicos: Apostólico, Niceno, Calcedônia, Atanásio
- Reforma Protestante: Lutero, Calvino, Zuínglio, Knox, contexto histórico
- Cinco Solas: Sola Scriptura, Sola Fide, Sola Gratia, Solus Christus, Soli Deo Gloria
- Confissões reformadas: Confissão de Westminster, Catecismo de Heidelberg, Confissão Belga
- Puritanismo e pietismo
- Grandes avivamentos: Wesley, Edwards, Whitefield, Finney
- Movimento missionário moderno: Carey, Hudson Taylor, Livingstone
- Igreja na América Latina e no Brasil: protestantismo de missão e de imigração
- Pentecostalismo e neopentecostalismo: origens e desenvolvimento`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "biblical_history,systematic_theology"
  },
  {
    id: "bible-systematic-theology-deep",
    title: "Teologia Sistemática Protestante Aprofundada",
    prompt: `Gere conteudo de teologia sistematica protestante detalhado:
- Teologia Própria: atributos de Deus (incomunicáveis e comunicáveis), Trindade
- Cristologia: duas naturezas, kenosis, ofícios (profeta, sacerdote, rei), estados (humilhação, exaltação)
- Pneumatologia: pessoa e obra do Espírito Santo, dons espirituais, fruto do Espírito
- Antropologia: imagem de Deus, queda, depravação total, livre-arbítrio (debate)
- Soteriologia: ordo salutis, eleição, chamado eficaz, regeneração, conversão, justificação, adoção, santificação, perseverança
- Eclesiologia: natureza da igreja, marcas, governo (episcopal, presbiteriano, congregacional), sacramentos/ordenanças
- Escatologia: estados intermediários, ressurreição, juízo final, céu, inferno, nova criação
- Debates: calvinismo vs arminianismo, cessacionismo vs continuísmo, criacionismo vs evolução teísta`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "systematic_theology"
  },
  {
    id: "bible-preaching-homiletics",
    title: "Homilética e Pregação Expositiva",
    prompt: `Gere guia completo sobre homiletica e pregaçao:
- Pregação expositiva: definição, metodologia, vantagens
- Estrutura de sermão: introdução, proposição, divisões, ilustrações, aplicação, conclusão
- Pregação textual, temática e biográfica
- Seleção e estudo do texto: observação, interpretação, aplicação
- Uso de contexto histórico e gramatical na pregação
- Ilustrações eficazes: fontes, técnicas, equilíbrio
- Aplicação: do texto ao ouvinte moderno
- Comunicação eficaz: clareza, paixão, autenticidade
- Série de sermões: planejamento, coerência, progressão
- Pregadores modelo: Spurgeon, Lloyd-Jones, John Stott, Tim Keller (método e contribuições)
- Erros comuns na pregação e como evitá-los
- Pregação em contexto brasileiro`,
    modules: "bible,hermeneutics",
    bibleStudyModules: "homiletics_preaching,devotional_practice"
  }
]

// ---------------------------------------------------------------------------
// OpenAI API call
// ---------------------------------------------------------------------------

async function callLLM(systemPrompt, userPrompt, retries = 3) {
  const headers = {
    "Content-Type": "application/json"
  }

  // Gemini uses x-goog-api-key, others use Bearer
  if (PROVIDER.name === "gemini") {
    headers["x-goog-api-key"] = PROVIDER.key
  } else {
    headers["Authorization"] = `Bearer ${PROVIDER.key}`
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(PROVIDER.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: PROVIDER.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: PROVIDER.maxTokens || 8192
      }),
      signal: AbortSignal.timeout(180_000)
    })

    if (response.status === 429 && attempt < retries) {
      // Parse retry-after or use exponential backoff
      const retryAfter = response.headers.get("retry-after")
      const waitMs = retryAfter
        ? Math.max(Number(retryAfter) * 1000, 5_000)
        : Math.min(30_000 * (attempt + 1), 120_000)
      console.log(`    ⏳ Rate limit, aguardando ${Math.round(waitMs / 1000)}s (tentativa ${attempt + 1}/${retries})...`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`${PROVIDER.name} API error ${response.status}: ${body.slice(0, 300)}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ""
  }

  throw new Error(`${PROVIDER.name} falhou apos ${retries} tentativas (rate limit)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Voce e um teologo protestante academico com profundo conhecimento biblico, historico e linguistico.
Gere conteudo em portugues brasileiro, sem acentos desnecessarios, claro e preciso.
Use formato de texto corrido com marcadores quando adequado.
Cite referencias biblicas (livro, capitulo e versiculo).
Mantenha tom academico mas acessivel para estudantes e pastores.
Inclua termos nas linguas originais (hebraico/grego) quando relevante, com transliteracao.
Nao inclua frontmatter YAML — apenas o conteudo textual.`

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const skipExisting = args.includes("--skip-existing")
  const topicIdxFlag = args.indexOf("--topic")
  const topicFilter = topicIdxFlag >= 0 ? args[topicIdxFlag + 1]?.toLowerCase() : null

  const topics = topicFilter
    ? BIBLE_TOPICS.filter((t) => t.id.includes(topicFilter) || t.title.toLowerCase().includes(topicFilter))
    : BIBLE_TOPICS

  if (topics.length === 0) {
    console.error(`❌ Nenhum topico encontrado para: ${topicFilter}`)
    console.log("Topicos disponiveis:")
    BIBLE_TOPICS.forEach((t) => console.log(`  - ${t.id}: ${t.title}`))
    process.exit(1)
  }

  console.log(`📖 Gerando conhecimento biblico para ${topics.length} topicos...`)
  if (dryRun) console.log("🧪 Modo dry-run — arquivos serao criados mas nao ingeridos no Supabase")

  let generated = 0
  let errors = 0

  for (const topic of topics) {
    console.log(`\n📝 [${topic.id}] ${topic.title}`)

    // Skip if file already exists and --skip-existing is set
    if (skipExisting) {
      const filePath = path.join(OUTPUT_DIR, `${topic.id}.md`)
      try {
        const stat = await fs.stat(filePath)
        if (stat.size > 500) {
          console.log(`  ⏭️ Ja existe (${stat.size} bytes), pulando...`)
          generated++
          continue
        }
      } catch { /* file doesn't exist, proceed */ }
    }

    try {
      const content = await callLLM(SYSTEM_PROMPT, topic.prompt)

      if (!content || content.length < 200) {
        console.warn(`  ⚠️ Conteudo muito curto (${content.length} chars), pulando...`)
        errors++
        continue
      }

      // Build front matter
      const frontMatter = [
        "---",
        `source: ${PROVIDER.name}-generated`,
        `license: internal`,
        `title: ${topic.title}`,
        `category: bible`,
        `categories: bible, theology, pastoral_theology`,
        `modules: ${topic.modules}`,
        `bibleStudyModules: ${topic.bibleStudyModules}`,
        `language: pt`,
        `generatedAt: ${new Date().toISOString()}`,
        `model: ${PROVIDER.model}`,
        "---",
        ""
      ].join("\n")

      const filePath = path.join(OUTPUT_DIR, `${topic.id}.md`)
      await fs.writeFile(filePath, frontMatter + content, "utf8")
      console.log(`  ✅ Salvo: ${path.relative(process.cwd(), filePath)} (${content.length} chars)`)
      generated++

      // Rate limiting: respect provider limits
      if (topics.indexOf(topic) < topics.length - 1) {
        await new Promise((r) => setTimeout(r, PROVIDER.rateDelayMs))
      }
    } catch (err) {
      console.error(`  ❌ Erro: ${err.message}`)
      errors++
    }
  }

  console.log(`\n📊 Resultado: ${generated} gerados, ${errors} erros`)

  if (!dryRun && generated > 0) {
    console.log("\n📥 Para ingerir no Supabase, execute:")
    console.log("   node scripts/ingest-knowledge.js --dir knowledge/curated --category bible")
  }
}

main().catch((err) => {
  console.error("❌ Falha:", err.message)
  process.exit(1)
})

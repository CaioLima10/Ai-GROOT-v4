import path from "node:path"
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import { fileURLToPath } from "node:url"

import pdfParse from "pdf-parse/lib/pdf-parse.js"
import { chromium } from "playwright"

import { resolveFrontendBaseUrl } from "./lib/resolveFrontendBaseUrl.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const fixtureDir = path.join(repoRoot, "tmp_document_runtime_eval")
const { baseUrl } = await resolveFrontendBaseUrl()
const timestamp = new Date().toISOString().replace(/[.:]/g, "-")

function readCliOption(name) {
  const args = process.argv.slice(2)
  for (let index = 0; index < args.length; index += 1) {
    const current = String(args[index] || "").trim()
    if (!current) continue

    if (current === `--${name}`) {
      const nextValue = String(args[index + 1] || "").trim()
      return nextValue || ""
    }

    const prefix = `--${name}=`
    if (current.startsWith(prefix)) {
      return current.slice(prefix.length).trim()
    }
  }

  return ""
}

function hasCliFlag(name) {
  return process.argv.slice(2).some((entry) => String(entry || "").trim() === `--${name}`)
}

const profileId = String(readCliOption("profile") || process.env.GIOM_MULTIMODAL_PROFILE || "long60").trim().toLowerCase()
const realtimePacing = hasCliFlag("realtime") || String(process.env.GIOM_BATTERY_REALTIME || "").trim() === "1"

const roboticOpeners = [
  /^(claro|certamente|excelente|otima pergunta|ótima pergunta|com prazer|ol[aá] s[oó]|entendido)[!,. ]/i
]

const roboticClosers = [
  /estou aqui se precisar/i,
  /fico a disposicao/i,
  /qualquer duvida e so perguntar/i,
  /qualquer dúvida é só perguntar/i
]

function fixturePath(name) {
  return path.join(fixtureDir, name)
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function normalizeUiText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function includesAll(text = "", fragments = []) {
  const normalized = normalizeText(text)
  return fragments.every((fragment) => normalized.includes(normalizeText(fragment)))
}

function includesAny(text = "", fragments = []) {
  const normalized = normalizeText(text)
  return fragments.some((fragment) => normalized.includes(normalizeText(fragment)))
}

function getFileExtensionFromMime(mimeType = "") {
  const normalized = String(mimeType || "").toLowerCase()
  if (normalized.includes("png")) return ".png"
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg"
  if (normalized.includes("webp")) return ".webp"
  if (normalized.includes("svg")) return ".svg"
  return ".bin"
}

function decodeDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  }
}

function getLastAssistantMessage(state) {
  return [...(state?.messages || [])].reverse().find((message) => message.role === "assistant") || null
}

function countTurns(threads = []) {
  return threads.reduce((sum, thread) => sum + (Array.isArray(thread.turns) ? thread.turns.length : 0), 0)
}

function buildLong60Threads() {
  return [
    {
      id: "engineering_professional",
      label: "Engenharia profissional",
      equivalentMinutes: 10,
      turns: [
        {
          id: "eng_seed",
          category: ["tone", "continuity"],
          question: "Estamos revisando uma API Node para reduzir latencia e melhorar clareza para o time. Responda apenas: combinado.",
          expectAll: [/combinado/i],
          forbid: [/latencia/i, /claridade/i, /time/i]
        },
        {
          id: "eng_plan",
          category: ["tone", "continuity", "human_flow"],
          question: "Com esse foco, me de 3 frentes objetivas para comecar.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/latencia/i, /observ/i, /cache/i, /fila/i, /medir/i, /gargalo/i]
        },
        {
          id: "eng_second_point",
          category: ["reference_resolution", "continuity"],
          question: "Pegue o segundo ponto e detalhe sem repetir a lista inteira.",
          expectAny: [/medir/i, /observ/i, /metrica/i, /m[eé]trica/i, /telemet/i, /p95/i, /p99/i],
          forbid: [/1\..*2\..*3\./i]
        },
        {
          id: "eng_pronoun_reference",
          category: ["reference_resolution", "continuity"],
          question: "Quando eu disser 'isso', estou falando desse segundo ponto. O que devo medir primeiro?",
          expectAny: [/p95/i, /p99/i, /erro/i, /latencia/i, /latência/i, /tempo/i, /throughput/i]
        },
        {
          id: "eng_small_team",
          category: ["correction_handling", "tone"],
          question: "Nosso time e pequeno, entao simplifique isso para algo que caiba em uma semana.",
          expectAny: [/semana/i, /prioridade/i, /primeiro/i, /enxut/i, /gargalo/i, /dependencia|dependência/i],
          forbid: [/princ[ií]pios b[aá]sicos/i, /cards e json/i]
        },
        {
          id: "eng_topic_shift_jwt",
          category: ["topic_shift", "tone"],
          question: "Mudando de assunto: explique JWT para um gerente de produto, sem jargao.",
          expectAny: [/login/i, /identidade/i, /permiss/i, /acesso/i, /sess[aã]o/i],
          forbid: [/p95/i, /observ/i, /latencia/i, /latência/i]
        },
        {
          id: "eng_return_to_api",
          category: ["continuity", "reference_resolution"],
          question: "Agora volte ao plano da API e feche em duas frases executivas.",
          expectAny: [/api/i, /latencia/i, /latência/i, /medir/i, /prioridade/i],
          forbid: [/jwt/i, /token/i]
        }
      ]
    },
    {
      id: "bible_pastoral",
      label: "Biblico pastoral",
      equivalentMinutes: 10,
      turns: [
        {
          id: "bible_seed",
          category: ["tone", "continuity"],
          question: "Agora estamos estudando Romanos 8 e quero um tom maduro, sem pieguice. Responda apenas: ok.",
          expectAll: [/^ok\.?$/i]
        },
        {
          id: "bible_theme",
          category: ["tone", "continuity"],
          question: "Qual e o eixo central desse capitulo em 3 linhas curtas?",
          expectAny: [/roman/i, /esp[ií]rito/i, /condena/i, /seguran/i, /filhos/i]
        },
        {
          id: "bible_application",
          category: ["human_flow", "tone", "continuity"],
          question: "Aplique isso para alguem ansioso, mas sem soar artificial.",
          expectAny: [/ansios/i, /medo/i, /seguran/i, /descanso/i, /firmeza/i],
          forbid: [/claro!/i, /estou aqui se precisar/i]
        },
        {
          id: "bible_reference_text",
          category: ["reference_resolution", "continuity"],
          question: "Quando eu disser 'esse texto', continue em Romanos 8. Esse texto fala mais de culpa ou de seguranca?",
          expectAny: [/culpa/i, /seguran/i, /roman/i],
          forbid: [/Romanos 8 \(NAA\) 1/i, /24 versiculos/i, /24 versículos/i]
        },
        {
          id: "bible_topic_shift_study_plan",
          category: ["topic_shift", "tone", "human_flow"],
          question: "Agora outro assunto: me monte um estudo biblico semanal de 4 blocos.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/leitura/i, /observa/i, /aplica/i, /ora[cç][aã]o/i, /revis[aã]o/i],
          forbid: [/culpa/i, /seguran/i]
        },
        {
          id: "bible_return_with_prayer",
          category: ["continuity", "reference_resolution", "tone"],
          question: "Volte a esse texto e feche com uma oracao curta.",
          expectAny: [/senhor/i, /deus/i, /am[eé]m/i, /roman/i]
        }
      ]
    },
    {
      id: "capabilities_clock",
      label: "Capacidades e hora atual",
      equivalentMinutes: 10,
      turns: [
        {
          id: "cap_live_web",
          category: ["capabilities", "tone"],
          question: "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?",
          expectAny: [/nao/i, /não/i, /pesquisa web ao vivo/i, /nao consigo verificar agora/i, /não consigo verificar agora/i]
        },
        {
          id: "cap_professional_tone",
          category: ["capabilities", "tone"],
          question: "Responda isso de forma profissional, sem parecer um robo.",
          expectAny: [/google/i, /base curada/i, /mem[oó]ria conversacional/i, /web ao vivo/i],
          forbid: [/sou uma ia/i, /otima pergunta/i, /excelente/i]
        },
        {
          id: "cap_practical_strengths",
          category: ["capabilities", "tone"],
          question: "Entao diga em termos praticos o que voce consegue fazer bem nesta execucao.",
          expectAny: [/analisar/i, /organizar/i, /resumir/i, /explicar/i, /contexto/i, /mem[oó]ria/i]
        },
        {
          id: "cap_current_data_rule",
          category: ["capabilities", "tone"],
          question: "Se eu pedir um dado muito atual, como voce deve responder?",
          expectAny: [/nao inventar/i, /não inventar/i, /mais contexto/i, /nova tentativa/i, /nao consegui confirmar/i, /não consegui confirmar/i]
        },
        {
          id: "cap_now_datetime",
          category: ["operational_shortcut", "current_time"],
          question: "qual horario de agora , dia mes e ano",
          expectAll: [/\d{2}:\d{2}/, /\d{2}\/\d{2}\/\d{4}/],
          forbid: [/jogo/i, /partida/i, /agenda esportiva/i, /flamengo/i, /santos/i]
        }
      ]
    },
    {
      id: "multimodal_upload_reading",
      label: "Leitura de anexos",
      equivalentMinutes: 10,
      turns: [
        {
          id: "upload_pdf_goal",
          category: ["upload", "document_reading"],
          filePath: fixturePath("battery-pdf.pdf"),
          question: "Qual e o objetivo principal do arquivo?",
          expectAll: [/objetivo/i],
          expectAny: [/validar/i, /leitura/i, /anexos/i]
        },
        {
          id: "upload_pdf_summary_followup",
          category: ["upload", "follow_up", "document_routing"],
          question: "Faca um resumo curto disso em 2 linhas.",
          expectAny: [/leitura fiel/i, /anexos/i, /runtime/i, /validar/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "upload_sheet_test",
          category: ["upload", "spreadsheet_reading"],
          filePath: fixturePath("battery-sheet.xlsx"),
          question: "Qual item esta com status em teste?",
          expectAll: [/ocr/i, /teste/i]
        },
        {
          id: "upload_sheet_schedule_followup",
          category: ["upload", "follow_up", "document_routing"],
          question: "Agora monte um cronograma simples em 3 etapas com base nessa planilha, sem criar arquivo.",
          expectAny: [/(1\.|- )/i, /ocr/i, /follow/i, /leitura/i, /obrigatorio/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "upload_scanned_pdf_ocr",
          category: ["upload", "ocr", "pdf"],
          filePath: fixturePath("battery-scanned.pdf"),
          question: "Qual frase aparece no PDF escaneado?",
          expectAll: [/graca|graça/i, /verdade/i]
        },
        {
          id: "upload_image_ocr",
          category: ["upload", "ocr", "image"],
          filePath: fixturePath("battery-ocr-positive.png"),
          question: "Qual frase aparece na imagem?",
          expectAll: [/paz/i, /graca|graça/i]
        }
      ]
    },
    {
      id: "multimodal_generation",
      label: "Geracao multimodal",
      equivalentMinutes: 10,
      turns: [
        {
          id: "gen_table",
          category: ["table", "bible_materials"],
          question: "Monte uma tabela simples comparando culpa e seguranca em Romanos 8.",
          expectAny: [/culpa/i, /seguran/i, /roman/i]
        },
        {
          id: "gen_prompt",
          category: ["prompt", "bible_materials"],
          question: "Faca um prompt curto para estudar Romanos 8 por 7 dias.",
          expectAny: [/romanos 8/i, /7 dias/i, /leitura/i, /estudo/i]
        },
        {
          id: "gen_image",
          category: ["image_generation", "bible_materials"],
          question: "Crie uma imagem de capa para um guia de estudo de Romanos 8, luz dourada, sem texto.",
          expectImageArtifact: true
        },
        {
          id: "gen_pdf_genesis",
          category: ["document_generation", "pdf", "bible_materials"],
          question: "gere um pdf com o primeiro capitulo de genesis da biblia sagrada",
          expectDocumentDownload: ".pdf",
          expectDownloadedTextAny: ["genesis 1", "no principio", "no princípio"]
        },
        {
          id: "gen_pptx",
          category: ["document_generation", "presentation"],
          question: "Agora gere uma apresentacao pptx com 3 slides sobre Romanos 8.",
          expectDocumentDownload: ".pptx"
        },
        {
          id: "gen_xlsx",
          category: ["document_generation", "spreadsheet"],
          question: "Agora crie uma planilha xlsx com as colunas bloco, foco e pergunta sobre Romanos 8.",
          expectDocumentDownload: ".xlsx"
        }
      ]
    },
    {
      id: "memory_isolation",
      label: "Memoria e isolamento",
      equivalentMinutes: 10,
      turns: [
        {
          id: "mem_seed",
          category: ["continuity", "thread_isolation"],
          question: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado.",
          expectAll: [/registrado/i]
        },
        {
          id: "mem_recall_same_thread",
          category: ["continuity", "thread_isolation"],
          question: "Qual e meu nome e qual assunto estamos tratando?",
          expectAll: [/marina/i],
          expectAny: [/onboarding/i, /clientes/i]
        },
        {
          id: "mem_followup_same_thread",
          category: ["continuity", "reference_resolution"],
          question: "Com esse assunto, me de 2 prioridades iniciais em tom executivo.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/onboarding/i, /cliente/i, /prioridade/i, /etapa/i]
        },
        {
          id: "mem_recall_new_thread",
          category: ["thread_isolation"],
          newChatBefore: true,
          question: "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?",
          expectAny: [/nao tenho essa informacao/i, /não tenho essa informação/i, /ainda nao tenho/i, /ainda não tenho/i, /me diga de novo/i],
          forbid: [/marina/i, /onboarding/i, /clientes/i]
        },
        {
          id: "mem_new_thread_seed",
          category: ["thread_isolation", "continuity"],
          question: "Agora nesta conversa estamos falando de implantacao de CRM. Responda apenas: ok.",
          expectAll: [/^ok\.?$/i]
        }
      ]
    }
  ]
}

function buildVerify30Threads() {
  return [
    {
      id: "capabilities_clock_verify",
      label: "Capacidades e hora atual",
      equivalentMinutes: 8,
      turns: [
        {
          id: "verify_cap_live_web",
          category: ["capabilities"],
          question: "Hoje voce consegue pesquisar Google ao vivo e verificar informacoes atuais?",
          expectAny: [/nao/i, /não/i, /pesquisa web ao vivo/i, /nao consigo verificar agora/i, /não consigo verificar agora/i]
        },
        {
          id: "verify_cap_tone",
          category: ["capabilities", "tone"],
          question: "Responda isso de forma profissional, sem parecer um robo.",
          expectAny: [/google/i, /base curada/i, /mem[oó]ria conversacional/i, /web ao vivo/i],
          forbid: [/sou uma ia/i, /otima pergunta/i, /excelente/i]
        },
        {
          id: "verify_cap_now_datetime",
          category: ["current_time"],
          question: "qual horario de agora , dia mes e ano",
          expectAll: [/\d{2}:\d{2}/, /\d{2}\/\d{2}\/\d{4}/],
          forbid: [/jogo/i, /partida/i, /agenda esportiva/i]
        },
        {
          id: "verify_cap_data_rule",
          category: ["capabilities"],
          question: "Se eu pedir um dado muito atual, como voce deve responder?",
          expectAny: [/nao inventar/i, /não inventar/i, /mais contexto/i, /nova tentativa/i, /nao consegui confirmar/i, /não consegui confirmar/i]
        }
      ]
    },
    {
      id: "upload_reading_verify",
      label: "Leitura de anexos",
      equivalentMinutes: 8,
      turns: [
        {
          id: "verify_upload_pdf_goal",
          category: ["upload", "document_reading"],
          filePath: fixturePath("battery-pdf.pdf"),
          question: "Qual e o objetivo principal do arquivo?",
          expectAny: [/validar/i, /leitura/i, /anexos/i]
        },
        {
          id: "verify_upload_pdf_summary_followup",
          category: ["upload", "document_routing"],
          question: "Faca um resumo curto disso em 2 linhas.",
          expectAny: [/leitura fiel/i, /anexos/i, /runtime/i, /validar/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "verify_upload_sheet_schedule_followup",
          category: ["upload", "document_routing"],
          filePath: fixturePath("battery-sheet.xlsx"),
          question: "Agora monte um cronograma simples em 3 etapas com base nessa planilha, sem criar arquivo.",
          expectAny: [/(1\.|- )/i, /ocr/i, /follow/i, /leitura/i, /obrigatorio/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "verify_upload_scanned_pdf_ocr",
          category: ["upload", "ocr"],
          filePath: fixturePath("battery-scanned.pdf"),
          question: "Qual frase aparece no PDF escaneado?",
          expectAll: [/graca|graça/i, /verdade/i]
        },
        {
          id: "verify_upload_image_ocr",
          category: ["upload", "ocr"],
          filePath: fixturePath("battery-ocr-positive.png"),
          question: "Qual frase aparece na imagem?",
          expectAll: [/paz/i, /graca|graça/i]
        }
      ]
    },
    {
      id: "generation_verify",
      label: "Geracao multimodal",
      equivalentMinutes: 8,
      turns: [
        {
          id: "verify_gen_image",
          category: ["image_generation"],
          question: "Crie uma imagem de capa para um guia de estudo de Romanos 8, luz dourada, sem texto.",
          expectImageArtifact: true
        },
        {
          id: "verify_gen_pdf_genesis",
          category: ["document_generation", "pdf"],
          question: "gere um pdf com o primeiro capitulo de genesis da biblia sagrada",
          expectDocumentDownload: ".pdf",
          expectDownloadedTextAny: ["genesis 1", "no principio", "no princípio"]
        },
        {
          id: "verify_gen_pptx",
          category: ["document_generation", "presentation"],
          question: "Agora gere uma apresentacao pptx com 3 slides sobre Romanos 8.",
          expectDocumentDownload: ".pptx"
        },
        {
          id: "verify_gen_xlsx",
          category: ["document_generation", "spreadsheet"],
          question: "Agora crie uma planilha xlsx com as colunas bloco, foco e pergunta sobre Romanos 8.",
          expectDocumentDownload: ".xlsx"
        }
      ]
    },
    {
      id: "memory_verify",
      label: "Memoria e isolamento",
      equivalentMinutes: 6,
      turns: [
        {
          id: "verify_mem_seed",
          category: ["continuity"],
          question: "Meu nome e Marina e estamos tratando de onboarding de clientes. Responda apenas: registrado.",
          expectAll: [/registrado/i]
        },
        {
          id: "verify_mem_recall_same_thread",
          category: ["continuity"],
          question: "Qual e meu nome e qual assunto estamos tratando?",
          expectAll: [/marina/i],
          expectAny: [/onboarding/i, /clientes/i]
        },
        {
          id: "verify_mem_recall_new_thread",
          category: ["thread_isolation"],
          newChatBefore: true,
          question: "Sem olhar outras conversas, qual e meu nome e qual assunto estamos tratando?",
          expectAny: [/nao tenho essa informacao/i, /não tenho essa informação/i, /ainda nao tenho/i, /ainda não tenho/i, /me diga de novo/i],
          forbid: [/marina/i, /onboarding/i, /clientes/i]
        }
      ]
    }
  ]
}

function buildGeneral60Threads() {
  return [
    ...buildLong60Threads(),
    {
      id: "live_data_followups",
      label: "Clima, jogos e retorno",
      equivalentMinutes: 10,
      turns: [
        {
          id: "live_weather_sao_paulo",
          category: ["weather", "topic_shift", "continuity"],
          question: "Qual clima de hoje em Sao Paulo, Brasil?",
          expectAll: [/sao paulo/i],
          expectAny: [/temperatura|maxima|minima|chuva|umidade|vento|graus|°/i, /nao encontrei a localidade|não encontrei a localidade|me diga .*cidade/i],
          forbid: [/santos/i, /partida/i]
        },
        {
          id: "live_weather_followup_tomorrow",
          category: ["weather", "reference_resolution", "continuity"],
          question: "E amanha na mesma cidade, em 2 linhas curtas?",
          expectAny: [/amanha|amanhã|temperatura|maxima|minima|chuva|umidade|vento/i],
          forbid: [/santos/i, /partida/i]
        },
        {
          id: "live_sports_santos",
          category: ["sports", "topic_shift", "continuity"],
          question: "Mudando de assunto: qual proximo jogo do Santos FC?",
          expectAll: [/santos/i],
          expectAny: [/jogo|partida|rodada|campeonato|vs| x /i],
          forbid: [/temperatura|chuva|umidade/i]
        },
        {
          id: "live_sports_followup_details",
          category: ["sports", "reference_resolution", "continuity"],
          question: "E qual horario dessa partida e qual campeonato?",
          expectAny: [/\d{1,2}:\d{2}/, /campeonato|brasileiro|copa|paulista|serie|série|libertadores/i],
          forbid: [/temperatura|chuva|umidade/i]
        },
        {
          id: "live_datetime_after_sports",
          category: ["current_time", "operational_shortcut", "topic_shift"],
          question: "Agora me diga so o horario de agora, dia mes e ano.",
          expectAll: [/\d{2}:\d{2}/, /\d{2}\/\d{2}\/\d{4}/],
          forbid: [/santos/i, /partida/i, /campeonato/i]
        },
        {
          id: "live_return_weather_summary",
          category: ["weather", "continuity", "reference_resolution"],
          question: "Voltando ao clima de Sao Paulo, resuma o essencial em 2 linhas.",
          expectAny: [/sao paulo|temperatura|chuva|umidade|maxima|minima|clima/i],
          forbid: [/santos/i, /partida/i]
        }
      ]
    },
    {
      id: "personalized_sessions",
      label: "Respostas personalizadas",
      equivalentMinutes: 10,
      turns: [
        {
          id: "style_seed",
          category: ["personalization", "continuity"],
          question: "Meu nome e Lucas. Prefiro respostas curtas, sem emoji, tom executivo e estamos tratando de onboarding de clientes. Responda apenas: registrado.",
          expectAll: [/registrado/i]
        },
        {
          id: "style_onboarding_exec",
          category: ["personalization", "tone", "continuity"],
          question: "Com esse estilo e esse assunto, me de 2 prioridades iniciais em tom executivo.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/onboarding|cliente|prioridade|etapa|prazo|bloqueio/i],
          forbid: [/otima pergunta|ótima pergunta|excelente/i]
        },
        {
          id: "style_checklist_rollout",
          category: ["personalization", "checklist", "continuity"],
          question: "Agora transforme esse onboarding em checklist curto de rollout com 3 itens.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/rollout|risco|prazo|responsavel|responsável|etapa/i]
        },
        {
          id: "style_timeline_exec",
          category: ["personalization", "timeline", "continuity"],
          question: "No mesmo estilo, transforme esse onboarding em uma linha do tempo curta de 4 marcos.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/marco|semana|fase|linha do tempo|prazo/i]
        },
        {
          id: "style_topic_shift_pastoral",
          category: ["personalization", "topic_shift", "tone"],
          question: "Mudando de assunto: fale com tom pastoral maduro para alguem ansioso a partir de Romanos 8.",
          expectAny: [/roman|ansios|medo|seguran|paz|esp[ií]rito/i],
          forbid: [/rollout|prazo|responsavel|responsável/i]
        },
        {
          id: "style_return_exec_priorities",
          category: ["personalization", "reference_resolution", "continuity"],
          question: "Agora deixe Romanos 8 de lado, volte ao onboarding de clientes e me de 2 prioridades iniciais em tom executivo para lideranca.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/prioridade|lideranca|liderança|acao|ação|foco|decis|onboarding|cliente|prazo|bloqueio/i]
        }
      ]
    },
    {
      id: "document_formats_plus",
      label: "Formatos e blocos especiais",
      equivalentMinutes: 10,
      turns: [
        {
          id: "gen_docx_onboarding",
          category: ["document_generation", "docx", "personalization"],
          question: "Agora gere um documento docx com um plano de onboarding de clientes em 5 pontos.",
          expectDocumentDownload: ".docx"
        },
        {
          id: "text_table_onboarding",
          category: ["table", "document_routing", "continuity"],
          question: "Sem gerar arquivo, monte uma tabela simples com etapa, objetivo e risco para esse onboarding.",
          expectAny: [/etapa|objetivo|risco|onboarding/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "text_timeline_onboarding",
          category: ["timeline", "document_routing", "continuity"],
          question: "Ainda sem arquivo, crie uma linha do tempo curta de 4 marcos para esse onboarding.",
          expectAll: [/(1\.|- )/i],
          expectAny: [/marco|semana|fase|linha do tempo|prazo/i],
          expectNoDocumentArtifact: true
        },
        {
          id: "text_prompt_onboarding",
          category: ["prompt", "document_routing", "continuity"],
          question: "Ainda sem arquivo, me de um prompt curto para outro analista tocar esse onboarding.",
          expectAny: [/prompt|objetivo|contexto|saida|saída|entregavel|entregável/i],
          expectNoDocumentArtifact: true
        }
      ]
    }
  ]
}

const profileMap = {
  long60: {
    id: "long60",
    label: "Bateria multimodal longa",
    equivalentMinutes: 60,
    threads: buildLong60Threads()
  },
  general60: {
    id: "general60",
    label: "Bateria geral de 1 hora",
    equivalentMinutes: 60,
    reportNamespace: "giom-general-battery",
    threads: buildGeneral60Threads()
  },
  verify30: {
    id: "verify30",
    label: "Bateria multimodal de verificacao",
    equivalentMinutes: 30,
    threads: buildVerify30Threads()
  }
}

const selectedProfile = profileMap[profileId] || profileMap.long60
const targetDurationMs = selectedProfile.equivalentMinutes * 60_000
const reportNamespace = String(selectedProfile.reportNamespace || "giom-multimodal-battery").trim() || "giom-multimodal-battery"
const reportDir = path.join(repoRoot, "reports", reportNamespace, `${timestamp}-${selectedProfile.id}`)

async function ensureFixtures(threads = []) {
  const filePaths = threads
    .flatMap((thread) => thread.turns || [])
    .map((turn) => turn.filePath)
    .filter(Boolean)

  for (const filePath of new Set(filePaths)) {
    await access(filePath, fsConstants.F_OK)
  }
}

async function waitForComposer(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForSelector("#msg", { timeout: 60_000 })
  await page.waitForSelector("#sendBtn", { timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => { })
  await page.waitForFunction(
    () => window.localStorage.getItem("giom-web-next-threads") !== null,
    { timeout: 15_000 }
  ).catch(() => { })
  await sleep(1_000)
}

async function captureConversationState(page) {
  return await page.evaluate(() => {
    const requestError = document.querySelector(".request-error")?.textContent?.trim() || ""
    const inputValue = document.querySelector("#msg")?.value || ""
    const messages = Array.from(document.querySelectorAll("article.message.chat-message")).map((element, index) => {
      const bubble = element.querySelector(".bubble")
      const role = element.getAttribute("data-role") || ""
      const thinking = element.getAttribute("data-thinking") === "true"
      const text = (bubble?.textContent || "").replace(/\s+/g, " ").trim()
      const images = Array.from(element.querySelectorAll("img")).map((img) => ({
        alt: img.getAttribute("alt") || "",
        src: img.getAttribute("src") || ""
      }))

      return {
        index,
        role,
        thinking,
        text,
        imageCount: images.length,
        images,
        documentDownloadCount: element.querySelectorAll('button[aria-label="Download documento"]').length,
        imageDownloadCount: element.querySelectorAll('button[aria-label="Download imagem"]').length
      }
    })

    return {
      requestError,
      inputValue,
      title: document.title,
      url: window.location.href,
      messageCount: messages.length,
      messages
    }
  })
}

async function waitForSubmissionStart(page, question, timeoutMs = 12_000) {
  const startedAt = Date.now()
  const expectedQuestion = normalizeUiText(question)

  while (Date.now() - startedAt < timeoutMs) {
    const state = await captureConversationState(page)
    const lastUser = [...state.messages].reverse().find((message) => message.role === "user")
    const normalizedUserText = normalizeUiText(lastUser?.text || "")
    const hasMatchingUserMessage = Boolean(
      normalizedUserText
      && (normalizedUserText === expectedQuestion
        || normalizedUserText.includes(expectedQuestion)
        || expectedQuestion.includes(normalizedUserText))
    )
    const hasPendingAssistant = state.messages.some((message) => message.role === "assistant" && message.thinking)

    if (state.requestError || hasMatchingUserMessage || hasPendingAssistant) {
      return true
    }

    await sleep(250)
  }

  return false
}

async function submitTurn(page, turn) {
  if (turn.filePath) {
    await page.setInputFiles("#fileInput", turn.filePath)
    await page.waitForFunction(
      () => document.querySelectorAll(".composer-selected-file").length > 0,
      { timeout: 10_000 }
    )
  }

  await page.fill("#msg", turn.question)
  await page.waitForFunction(() => {
    const input = document.querySelector("#msg")
    const sendButton = document.querySelector("#sendBtn")
    return Boolean(input?.value?.trim()) && Boolean(sendButton) && !sendButton.disabled
  }, { timeout: 10_000 })

  const attempts = [
    async () => {
      await page.click("#sendBtn")
    },
    async () => {
      await page.focus("#msg")
      await page.keyboard.press("Enter")
    },
    async () => {
      await page.evaluate(() => {
        document.querySelector("#composerShell")?.requestSubmit()
      })
    }
  ]

  for (let index = 0; index < attempts.length; index += 1) {
    await attempts[index]()
    if (await waitForSubmissionStart(page, turn.question)) {
      return
    }

    if (index < attempts.length - 1) {
      if (turn.filePath) {
        await page.setInputFiles("#fileInput", turn.filePath)
      }
      await page.fill("#msg", turn.question)
      await sleep(500)
    }
  }

  throw new Error("Question submission did not start in the chat UI.")
}

async function waitForAssistantAnswer(page, timeoutMs = 180_000) {
  const startedAt = Date.now()
  let stableSignature = ""
  let stableCount = 0
  let latestState = null

  while (Date.now() - startedAt < timeoutMs) {
    latestState = await captureConversationState(page)
    const lastAssistant = getLastAssistantMessage(latestState)
    const lastPending = latestState.messages[latestState.messages.length - 1]?.thinking === true
    const hasAnswerContent = Boolean(
      lastAssistant
      && (
        lastAssistant.text
        || lastAssistant.imageCount > 0
        || lastAssistant.documentDownloadCount > 0
        || lastAssistant.imageDownloadCount > 0
      )
    )

    if (!lastPending && (hasAnswerContent || latestState.requestError)) {
      const signature = JSON.stringify({
        requestError: latestState.requestError,
        messageCount: latestState.messageCount,
        assistantText: lastAssistant?.text || "",
        imageCount: lastAssistant?.imageCount || 0,
        documentDownloadCount: lastAssistant?.documentDownloadCount || 0,
        imageDownloadCount: lastAssistant?.imageDownloadCount || 0
      })

      if (signature === stableSignature) {
        stableCount += 1
      } else {
        stableSignature = signature
        stableCount = 1
      }

      if (stableCount >= 3) {
        return latestState
      }
    }

    await sleep(1_500)
  }

  return latestState || await captureConversationState(page)
}

async function clickNewChat(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"))
    const target = buttons.find((button) => {
      const text = button.textContent || ""
      if (!text.includes("+ Novo chat")) return false
      const style = window.getComputedStyle(button)
      return style.visibility !== "hidden" && style.display !== "none" && button.getClientRects().length > 0
    })

    if (!target) {
      throw new Error("Visible new-chat button not found.")
    }

    target.click()
  })

  await page.waitForFunction(
    () => document.querySelectorAll("article.message.chat-message").length === 0,
    { timeout: 15_000 }
  )
  await page.waitForSelector("#msg", { timeout: 10_000 })
  await sleep(1_000)
}

async function focusLatestExchange(page) {
  await page.evaluate(() => {
    const messages = Array.from(document.querySelectorAll("article.message.chat-message"))
    const target = messages[messages.length - 1] || null
    target?.scrollIntoView({ behavior: "auto", block: "start" })
  })
  await sleep(300)
}

async function downloadLatestAssistantDocument(page, turnDir) {
  const selector = 'article.message.chat-message[data-role="assistant"] button[aria-label="Download documento"]'
  const locator = page.locator(selector)
  const count = await locator.count()
  if (!count) return null

  const button = locator.nth(count - 1)
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 8_000 }),
    button.click()
  ])

  const fileName = download.suggestedFilename()
  const targetPath = path.join(turnDir, fileName)
  await download.saveAs(targetPath)
  const stats = await stat(targetPath)
  const result = {
    fileName,
    targetPath,
    size: stats.size,
    parsedText: ""
  }

  if (/\.pdf$/i.test(fileName)) {
    try {
      const buffer = await readFile(targetPath)
      const parsed = await pdfParse(buffer)
      result.parsedText = String(parsed?.text || "")
    } catch {
      result.parsedText = ""
    }
  }

  return result
}

async function captureLatestAssistantImage(page, turnDir, turnId) {
  const payload = await page.evaluate(async () => {
    const assistants = Array.from(document.querySelectorAll('article.message.chat-message[data-role="assistant"]'))
    for (let index = assistants.length - 1; index >= 0; index -= 1) {
      const article = assistants[index]
      const img = article.querySelector("img")
      if (!img) continue

      const src = img.getAttribute("src") || ""
      let dataUrl = src
      if (src && !src.startsWith("data:")) {
        const response = await fetch(src)
        const blob = await response.blob()
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(String(reader.result || ""))
          reader.onerror = () => reject(new Error("file_reader_failed"))
          reader.readAsDataURL(blob)
        })
      }

      return {
        alt: img.getAttribute("alt") || "",
        src,
        dataUrl,
        hasDownload: Boolean(article.querySelector('button[aria-label="Download imagem"]'))
      }
    }

    return null
  })

  if (!payload?.dataUrl) {
    return null
  }

  const decoded = decodeDataUrl(payload.dataUrl)
  if (!decoded) {
    return null
  }

  const extension = getFileExtensionFromMime(decoded.mimeType)
  const fileName = `${slugify(turnId || "generated-image")}${extension}`
  const targetPath = path.join(turnDir, fileName)
  await writeFile(targetPath, decoded.buffer)
  const stats = await stat(targetPath)

  return {
    fileName,
    targetPath,
    size: stats.size,
    mimeType: decoded.mimeType,
    alt: payload.alt || "",
    hasDownload: Boolean(payload.hasDownload)
  }
}

function validateTurnResponse(turn, result) {
  const failures = []
  const notes = []
  const answer = String(result.answer || "")
  const normalized = normalizeUiText(answer)

  if (result.requestError) {
    failures.push(`request_error:${result.requestError}`)
  }

  if (!normalized && !result.documentDownload && !result.imageArtifact) {
    failures.push("empty_response")
  }

  if (normalized && roboticOpeners.some((pattern) => pattern.test(normalized))) {
    failures.push("robotic_opener")
  }

  if (normalized && roboticClosers.some((pattern) => pattern.test(normalized))) {
    failures.push("robotic_closer")
  }

  if (/Continuando de onde paramos:/i.test(normalized)) {
    failures.push("robotic_continuation")
  }

  if (Array.isArray(turn.expectAll)) {
    for (const pattern of turn.expectAll) {
      if (!pattern.test(answer)) {
        failures.push(`missing_expected:${pattern}`)
      }
    }
  }

  if (Array.isArray(turn.expectAny) && turn.expectAny.length > 0) {
    const matched = turn.expectAny.some((pattern) => pattern.test(answer))
    if (!matched) {
      failures.push("missing_any_expected")
    }
  }

  if (Array.isArray(turn.forbid)) {
    for (const pattern of turn.forbid) {
      if (pattern.test(answer)) {
        failures.push(`forbidden_match:${pattern}`)
      }
    }
  }

  if (turn.expectNoDocumentArtifact && (result.assistant?.documentDownloadCount > 0 || result.documentDownload)) {
    failures.push("unexpected_document_artifact")
  }

  if (turn.expectNoImageArtifact && (result.assistant?.imageCount > 0 || result.imageArtifact)) {
    failures.push("unexpected_image_artifact")
  }

  if (turn.expectDocumentDownload) {
    if (!result.documentDownload) {
      failures.push("missing_document_download")
    } else {
      const expectedExtension = String(turn.expectDocumentDownload || "").toLowerCase()
      if (expectedExtension && !String(result.documentDownload.fileName || "").toLowerCase().endsWith(expectedExtension)) {
        failures.push(`unexpected_document_extension:${expectedExtension}`)
      }
      if (Number(result.documentDownload.size || 0) <= 0) {
        failures.push("empty_document_download")
      }
      if (Array.isArray(turn.expectDownloadedTextAny) && turn.expectDownloadedTextAny.length > 0) {
        const matched = includesAny(result.documentDownload.parsedText || "", turn.expectDownloadedTextAny)
        if (!matched) {
          failures.push("download_text_missing_any")
        }
      }
      if (Array.isArray(turn.expectDownloadedTextAll) && turn.expectDownloadedTextAll.length > 0) {
        const matched = includesAll(result.documentDownload.parsedText || "", turn.expectDownloadedTextAll)
        if (!matched) {
          failures.push("download_text_missing_all")
        }
      }
    }
  }

  if (turn.expectImageArtifact) {
    if (!result.imageArtifact) {
      failures.push("missing_image_artifact")
    } else if (Number(result.imageArtifact.size || 0) <= 0) {
      failures.push("empty_image_artifact")
    }
  }

  if (/\p{Extended_Pictographic}/u.test(answer)) {
    notes.push("emoji_detected")
  }

  const openerSignature = normalized.split(/\s+/).slice(0, 4).join(" ")

  return {
    passed: failures.length === 0,
    failures,
    notes,
    openerSignature
  }
}

function aggregateResults(turnResults = []) {
  const categoryTotals = {}
  const categoryPass = {}
  const openerCounts = {}
  const failureCounts = {}
  let requestErrorCount = 0
  let roboticFlags = 0
  let documentDownloadCount = 0
  let imageArtifactCount = 0

  for (const result of turnResults) {
    if (result.requestError) requestErrorCount += 1
    if (result.validation.failures.some((item) => /robotic_/.test(item))) roboticFlags += 1
    if (result.documentDownload) documentDownloadCount += 1
    if (result.imageArtifact) imageArtifactCount += 1

    for (const failure of result.validation.failures) {
      failureCounts[failure] = (failureCounts[failure] || 0) + 1
    }

    const opener = result.validation.openerSignature
    if (opener) {
      openerCounts[opener] = (openerCounts[opener] || 0) + 1
    }

    for (const category of result.category || []) {
      categoryTotals[category] = (categoryTotals[category] || 0) + 1
      if (result.validation.passed) {
        categoryPass[category] = (categoryPass[category] || 0) + 1
      }
    }
  }

  const categories = Object.keys(categoryTotals).sort().map((category) => ({
    category,
    total: categoryTotals[category],
    passed: categoryPass[category] || 0,
    score: categoryTotals[category] > 0
      ? Number(((categoryPass[category] || 0) / categoryTotals[category]).toFixed(3))
      : 0
  }))

  const repeatedOpeners = Object.entries(openerCounts)
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1])
    .map(([signature, count]) => ({ signature, count }))

  const topFailures = Object.entries(failureCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([failure, count]) => ({ failure, count }))

  const passedTurns = turnResults.filter((result) => result.validation.passed).length
  const score = turnResults.length > 0
    ? Number((Math.max(0, (passedTurns / turnResults.length) - (roboticFlags * 0.01))).toFixed(3))
    : 0

  return {
    totalTurns: turnResults.length,
    passedTurns,
    failedTurns: turnResults.length - passedTurns,
    requestErrorCount,
    roboticFlags,
    repeatedOpeners,
    topFailures,
    documentDownloadCount,
    imageArtifactCount,
    categories,
    score
  }
}

function deriveImprovementPoints(turnResults = []) {
  const improvements = new Map()

  for (const result of turnResults) {
    for (const failure of result.validation.failures) {
      if (failure === "unexpected_document_artifact") {
        improvements.set("document_routing", "Restringir o auto-roteamento de documentos para pedidos explicitos de arquivo/exportacao, preservando follow-ups como resumo e cronograma no fluxo normal do chat.")
      } else if (failure === "missing_document_download" || failure === "empty_document_download" || failure === "download_text_missing_any" || failure === "download_text_missing_all") {
        improvements.set("document_generation", "Endurecer a geracao de documentos com validacao do formato baixado e, para PDFs biblicos, validar o texto final contra a referencia pedida.")
      } else if (failure === "missing_image_artifact" || failure === "empty_image_artifact") {
        improvements.set("image_generation", "Validar renderizacao e serializacao de imagem no frontend para garantir artefato visivel mesmo quando o provedor externo cair para fallback local.")
      } else if (failure.startsWith("forbidden_match:/jogo") || failure.startsWith("forbidden_match:/partida") || failure.startsWith("forbidden_match:/agenda esportiva")) {
        improvements.set("time_shortcut", "Desambiguar perguntas de hora/data com atalho operacional deterministico para evitar contaminacao por cards esportivos.")
      } else if (failure.startsWith("request_error:")) {
        improvements.set("request_stability", "Fortalecer estabilidade do envio UI/API e capturar erros de request com mensagens acionaveis no chat.")
      } else if (failure === "missing_any_expected" || failure.startsWith("missing_expected:")) {
        improvements.set("grounding", "Melhorar ancoragem da resposta ao contexto atual para reforcar continuidade, leitura fiel de anexos e seguimento do pedido real.")
      }
    }
  }

  return [...improvements.values()]
}

function deriveSolutionSteps(turnResults = []) {
  const steps = []
  const failureSet = new Set(turnResults.flatMap((result) => result.validation.failures))

  if (failureSet.has("unexpected_document_artifact")) {
    steps.push("Ajustar a deteccao de tool intent no frontend para aceitar documento apenas quando houver pedido explicito de arquivo, formato ou exportacao.")
  }
  if ([...failureSet].some((failure) => failure === "missing_document_download" || failure === "empty_document_download" || failure.startsWith("download_text_missing_"))) {
    steps.push("Validar o blob baixado no renderer e garantir que o backend devolva conteudo coerente com o prompt, principalmente em PDFs biblicos deterministas.")
  }
  if (failureSet.has("missing_image_artifact") || failureSet.has("empty_image_artifact")) {
    steps.push("Verificar o fluxo /generate/image, o fallback local e a exibicao do data URL na ultima mensagem do assistente.")
  }
  if ([...failureSet].some((failure) => failure.startsWith("forbidden_match:/jogo") || failure.startsWith("forbidden_match:/partida") || failure.startsWith("forbidden_match:/agenda esportiva"))) {
    steps.push("Adicionar resposta operacional deterministica para perguntas de hora e data usando o relogio do runtime, sem delegar ao modelo.")
  }
  if ([...failureSet].some((failure) => failure.startsWith("request_error:"))) {
    steps.push("Instrumentar melhor o erro de requisicao no frontend e revisar bootstrap/hidratacao antes do primeiro envio da bateria.")
  }

  return steps
}

async function runTurn(page, thread, turn, counters) {
  const turnDir = path.join(reportDir, thread.id, `${String(counters.completedTurns + 1).padStart(2, "0")}-${slugify(turn.id)}`)
  await mkdir(turnDir, { recursive: true })

  if (turn.newChatBefore) {
    await clickNewChat(page)
  }

  const turnStartedAt = Date.now()
  await submitTurn(page, turn)
  const state = await waitForAssistantAnswer(page)
  const assistant = getLastAssistantMessage(state)
  const answer = normalizeUiText(assistant?.text || "")

  let documentDownload = null
  if (turn.expectDocumentDownload) {
    documentDownload = await downloadLatestAssistantDocument(page, turnDir).catch(() => null)
  }

  let imageArtifact = null
  if (turn.expectImageArtifact) {
    imageArtifact = await captureLatestAssistantImage(page, turnDir, turn.id).catch(() => null)
  }

  const validation = validateTurnResponse(turn, {
    answer,
    requestError: state.requestError,
    assistant,
    documentDownload,
    imageArtifact
  })

  const screenshotPath = path.join(turnDir, `${slugify(turn.id)}.png`)
  await focusLatestExchange(page)
  await page.screenshot({ path: screenshotPath, fullPage: true })

  counters.completedTurns += 1
  const elapsedMs = Date.now() - counters.sessionStartedAt
  const remainingTurns = Math.max(0, counters.totalTurns - counters.completedTurns)
  const remainingTargetMs = Math.max(0, targetDurationMs - elapsedMs)
  const thinkPauseMs = realtimePacing && remainingTurns > 0
    ? Math.max(0, Math.min(55_000, Math.round(remainingTargetMs / (remainingTurns + 1))))
    : 0

  return {
    id: turn.id,
    category: Array.isArray(turn.category) ? turn.category : [],
    question: turn.question,
    filePath: turn.filePath || null,
    requestError: state.requestError,
    answer,
    assistant,
    documentDownload,
    imageArtifact,
    screenshotPath,
    messageCount: state.messageCount,
    responseTimeMs: Date.now() - turnStartedAt,
    validation,
    thinkPauseMs
  }
}

await ensureFixtures(selectedProfile.threads)
await mkdir(reportDir, { recursive: true })

console.log(`GIOM multimodal battery starting at ${baseUrl}`)
console.log(`Profile: ${selectedProfile.id} (${selectedProfile.equivalentMinutes} minute equivalent)`)
console.log(`Realtime pacing: ${realtimePacing ? "enabled" : "disabled"}`)

const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const consoleMessages = []
  const pageErrors = []
  const networkEvents = []
  const threadSnapshots = []
  const turnResults = []

  page.on("console", (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text()
    })
  })

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack || ""
    })
  })

  page.on("response", (response) => {
    const request = response.request()
    const requestUrl = request.url()
    if (!requestUrl.includes("/backend/ask") && !requestUrl.includes("/backend/generate/") && !requestUrl.includes("/backend/upload")) {
      return
    }

    networkEvents.push({
      url: requestUrl,
      method: request.method(),
      status: response.status(),
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString()
    })
  })

  await waitForComposer(page)

  const counters = {
    totalTurns: countTurns(selectedProfile.threads),
    completedTurns: 0,
    sessionStartedAt: Date.now()
  }

  for (let threadIndex = 0; threadIndex < selectedProfile.threads.length; threadIndex += 1) {
    const thread = selectedProfile.threads[threadIndex]
    if (threadIndex > 0) {
      await clickNewChat(page)
    }

    console.log(`\n[Thread ${threadIndex + 1}/${selectedProfile.threads.length}] ${thread.label}`)

    for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
      const turn = thread.turns[turnIndex]
      console.log(`- Turn ${counters.completedTurns + 1}/${counters.totalTurns}: ${turn.id}`)

      const result = await runTurn(page, thread, turn, counters)
      turnResults.push({
        profileId: selectedProfile.id,
        threadId: thread.id,
        threadLabel: thread.label,
        threadEquivalentMinutes: thread.equivalentMinutes,
        turnIndex,
        ...result
      })

      console.log(`  responseTimeMs=${result.responseTimeMs} passed=${result.validation.passed}`)
      console.log(`  answer=${result.answer.slice(0, 220)}`)
      if (result.documentDownload) {
        console.log(`  documentDownload=${result.documentDownload.fileName}`)
      }
      if (result.imageArtifact) {
        console.log(`  imageArtifact=${result.imageArtifact.fileName}`)
      }
      if (!result.validation.passed) {
        console.log(`  failures=${result.validation.failures.join(" | ")}`)
      }

      await writeFile(
        path.join(reportDir, "summary.partial.json"),
        JSON.stringify({
          baseUrl,
          profileId: selectedProfile.id,
          reportDir,
          equivalentMinutes: selectedProfile.equivalentMinutes,
          realtimePacing,
          elapsedMs: Date.now() - counters.sessionStartedAt,
          completedTurns: counters.completedTurns,
          totalTurns: counters.totalTurns,
          turnResults,
          aggregate: aggregateResults(turnResults),
          improvementPoints: deriveImprovementPoints(turnResults),
          solutionSteps: deriveSolutionSteps(turnResults)
        }, null, 2),
        "utf8"
      )

      if (result.thinkPauseMs > 0 && counters.completedTurns < counters.totalTurns) {
        console.log(`  pacingPauseMs=${result.thinkPauseMs}`)
        await page.waitForTimeout(result.thinkPauseMs)
      }
    }

    const screenshotPath = path.join(reportDir, `${String(threadIndex + 1).padStart(2, "0")}-${thread.id}.png`)
    await focusLatestExchange(page)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    threadSnapshots.push({
      threadId: thread.id,
      label: thread.label,
      equivalentMinutes: thread.equivalentMinutes,
      screenshotPath
    })
  }

  if (realtimePacing) {
    const finalElapsedMs = Date.now() - counters.sessionStartedAt
    if (finalElapsedMs < targetDurationMs) {
      const remainingMs = targetDurationMs - finalElapsedMs
      console.log(`\nFinal pacing wait to reach target duration: ${remainingMs}ms`)
      await page.waitForTimeout(remainingMs)
    }
  }

  const aggregate = aggregateResults(turnResults)
  const summary = {
    baseUrl,
    reportDir,
    profileId: selectedProfile.id,
    profileLabel: selectedProfile.label,
    equivalentMinutes: selectedProfile.equivalentMinutes,
    realtimePacing,
    targetDurationMs,
    actualDurationMs: Date.now() - counters.sessionStartedAt,
    completedAt: new Date().toISOString(),
    aggregate,
    improvementPoints: deriveImprovementPoints(turnResults),
    solutionSteps: deriveSolutionSteps(turnResults),
    threadSnapshots,
    networkSummary: {
      totalRelevantCalls: networkEvents.length,
      failedCalls: networkEvents.filter((event) => event.status >= 400).length,
      uploadCalls: networkEvents.filter((event) => event.url.includes("/backend/upload")).length,
      documentCalls: networkEvents.filter((event) => event.url.includes("/backend/generate/document")).length,
      imageCalls: networkEvents.filter((event) => event.url.includes("/backend/generate/image")).length,
      askCalls: networkEvents.filter((event) => event.url.includes("/backend/ask")).length
    },
    consoleMessages,
    pageErrors,
    turnResults
  }

  await writeFile(path.join(reportDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")
  console.log("\nGIOM multimodal battery completed.")
  console.log(JSON.stringify({
    reportDir,
    profileId: selectedProfile.id,
    actualDurationMinutes: Number((summary.actualDurationMs / 60_000).toFixed(2)),
    equivalentMinutes: selectedProfile.equivalentMinutes,
    realtimePacing,
    score: aggregate.score,
    passedTurns: aggregate.passedTurns,
    failedTurns: aggregate.failedTurns,
    requestErrorCount: aggregate.requestErrorCount,
    documentDownloadCount: aggregate.documentDownloadCount,
    imageArtifactCount: aggregate.imageArtifactCount,
    topFailures: aggregate.topFailures,
    improvementPoints: summary.improvementPoints,
    solutionSteps: summary.solutionSteps
  }, null, 2))

  await context.close()
} catch (error) {
  const failure = {
    baseUrl,
    reportDir,
    profileId: selectedProfile.id,
    realtimePacing,
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  }

  await writeFile(path.join(reportDir, "summary.error.json"), JSON.stringify(failure, null, 2), "utf8")
  console.error(JSON.stringify(failure, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}

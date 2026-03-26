import { mkdir, writeFile } from "fs/promises"
import { spawn } from "child_process"
import dotenv from "dotenv"

dotenv.config()

const SERVER_PORT = Number(process.env.GIOM_EVAL_PORT || (3301 + (process.pid % 400)))
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`
const SERVER_ENTRY = "apps/api/src/server.js"
const REPORT_PATH = "reports/giom-stack-audit.json"

const PACK_IDS = [
  "core_diagnostics",
  "safety_hardening",
  "capability_integrity",
  "privacy_data_protection",
  "image_generation_workflows",
  "document_generation_workflows",
  "office_suite_workflows",
  "coding_expert_workflows",
  "profile_delivery_audit",
  "module_developer_expert",
  "module_bible_expert",
  "module_history_archaeology_expert",
  "module_research_expert",
  "module_cybersecurity_expert",
  "module_math_science_expert",
  "module_agribusiness_expert",
  "module_finance_expert",
  "module_games_logic_expert"
]

const PROFILE_SCENARIOS = {
  adaptive_teacher: "adaptive_teacher_delivery",
  senior_engineer: "senior_engineer_delivery",
  research_mentor: "research_mentor_delivery",
  expert_polymath: "expert_polymath_delivery"
}

const MODULE_PACKS = {
  developer: "module_developer_expert",
  bible: "module_bible_expert",
  history_archaeology: "module_history_archaeology_expert",
  research: "module_research_expert",
  cybersecurity: "module_cybersecurity_expert",
  math_science: "module_math_science_expert",
  agribusiness: "module_agribusiness_expert",
  finance: "module_finance_expert",
  games_logic: "module_games_logic_expert"
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function roundScore(value) {
  return Math.round(clamp(value) * 100) / 100
}

function toPercent(value) {
  return Math.round(clamp(value) * 100)
}

function scoreToLevel(score) {
  if (score >= 0.93) return "expert"
  if (score >= 0.84) return "advanced"
  if (score >= 0.72) return "medium"
  return "basic"
}

function average(values = []) {
  const filtered = values.filter((value) => Number.isFinite(value))
  if (filtered.length === 0) return 0
  return roundScore(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

function findDimension(summary, dimensionId) {
  return summary?.dimensions?.find((dimension) => dimension.id === dimensionId)?.score ?? 0
}

function findTurnScore(payload, scenarioId) {
  const turn = (payload?.turns || []).find((entry) => entry.scenarioId === scenarioId)
  return roundScore(turn?.evaluation?.score || 0)
}

function collectCapabilityFlags(matrix = {}) {
  const items = Object.values(matrix?.sections || {}).flatMap((section) => section.items || [])
  const statusOf = (id) => items.find((item) => item.id === id)?.status || "planned"

  return {
    liveWebReady: statusOf("live_web") === "ready",
    zipReady: statusOf("zip_archives") === "ready",
    officeReady: statusOf("office_binary_docs") === "ready",
    imageReady: statusOf("image_generation") === "ready",
    imageControlsReady: statusOf("image_controls") === "ready",
    imageEditingReady: statusOf("image_editing") === "ready",
    visualUnderstandingReady: statusOf("image_visual_understanding") === "ready",
    structuredDocsReady: statusOf("structured_docs") === "ready",
    privacyReady: statusOf("sensitive_redaction") === "ready" && statusOf("sensitive_learning_block") === "ready"
  }
}

function buildCapabilitySummary(matrix = {}) {
  return Object.values(matrix?.sections || {}).map((section) => ({
    id: section.id,
    label: section.label,
    ready: (section.items || []).filter((item) => item.status === "ready").length,
    partial: (section.items || []).filter((item) => item.status === "partial").length,
    planned: (section.items || []).filter((item) => item.status === "planned").length
  }))
}

function buildInternalAxes(results) {
  const core = results.core_diagnostics?.summary || {}
  const profileAudit = results.profile_delivery_audit?.summary?.score || 0
  const coding = average([
    results.coding_expert_workflows?.summary?.score || 0,
    results.module_developer_expert?.summary?.score || 0
  ])
  const docs = average([
    results.document_generation_workflows?.summary?.score || 0,
    results.office_suite_workflows?.summary?.score || 0,
    results.capability_integrity?.summary?.score || 0
  ])
  const image = average([
    results.image_generation_workflows?.summary?.score || 0,
    findDimension(results.capability_integrity?.summary, "comprehension"),
    findDimension(results.capability_integrity?.summary, "transparency")
  ])
  const reasoning = average([
    findDimension(core, "comprehension"),
    findDimension(core, "coherence"),
    results.module_research_expert?.summary?.score || 0
  ])
  const personality = average([
    profileAudit,
    findDimension(core, "conversation"),
    findDimension(core, "transparency")
  ])
  const efficiency = average([
    results.coding_expert_workflows?.summary?.score || 0,
    results.capability_integrity?.summary?.score || 0,
    findDimension(core, "coherence")
  ])
  const reflection = average([
    results.module_research_expert?.summary?.score || 0,
    findDimension(core, "transparency"),
    findDimension(core, "self_model")
  ])
  const assertiveness = average([
    findDimension(core, "comprehension"),
    findDimension(core, "conversation"),
    results.profile_delivery_audit?.summary?.score || 0
  ])

  return {
    personality,
    efficiency,
    conversation: roundScore(findDimension(core, "conversation")),
    reflection,
    reasoning,
    intelligence: average([reasoning, coding, docs]),
    assertiveness,
    coding,
    documents: docs,
    image
  }
}

function estimateParity(label, baseScore, penalties = [], notes = []) {
  const penaltyTotal = penalties.reduce((sum, penalty) => sum + penalty, 0)
  const score = roundScore(baseScore - penaltyTotal)
  return {
    label,
    score,
    percent: toPercent(score),
    level: scoreToLevel(score),
    notes
  }
}

function buildExternalParity(results, capabilityFlags, axes) {
  const core = results.core_diagnostics?.summary?.score || 0
  const docs = axes.documents
  const image = axes.image
  const coding = axes.coding
  const reasoning = axes.reasoning
  const personality = axes.personality
  const conversation = axes.conversation
  const research = results.module_research_expert?.summary?.score || 0

  return {
    chatgpt: estimateParity(
      "ChatGPT",
      average([core, reasoning, personality, conversation, docs, image, coding]),
      [
        capabilityFlags.liveWebReady ? 0 : 0.05,
        capabilityFlags.imageEditingReady ? 0 : 0.08,
        capabilityFlags.visualUnderstandingReady ? 0 : 0.06
      ],
      [
        "estimativa heuristica baseada em raciocinio, conversa, docs, imagem e honestidade operacional",
        capabilityFlags.imageEditingReady ? "edicao de imagem ativa" : "ainda sem image editing nativo comparavel",
        capabilityFlags.visualUnderstandingReady ? "entendimento visual ativo" : "ainda sem entendimento visual amplo alem de OCR"
      ]
    ),
    gemini: estimateParity(
      "Gemini",
      average([core, reasoning, personality, docs, image, research]),
      [
        capabilityFlags.liveWebReady ? 0 : 0.12,
        capabilityFlags.visualUnderstandingReady ? 0 : 0.1,
        capabilityFlags.imageEditingReady ? 0 : 0.08
      ],
      [
        "estimativa heuristica baseada em pesquisa, arquivos, multimodal e grounding",
        capabilityFlags.liveWebReady ? "grounding ao vivo parcialmente coberto" : "falta grounding ao vivo com Google Search",
        capabilityFlags.visualUnderstandingReady ? "multimodal visual ativo" : "falta entendimento visual multimodal de ponta"
      ]
    ),
    codex: estimateParity(
      "Codex",
      average([coding, results.module_developer_expert?.summary?.score || 0, reasoning]),
      [
        0.08
      ],
      [
        "estimativa heuristica baseada em coding workflows, raciocinio tecnico e execucao",
        "GIOM ainda nao tem a mesma integracao nativa de agente de codigo em workspace/IDE como produto dedicado"
      ]
    ),
    github_copilot: estimateParity(
      "GitHub Copilot",
      average([coding, results.module_developer_expert?.summary?.score || 0, personality]),
      [
        0.1
      ],
      [
        "estimativa heuristica baseada em coding assistance e clareza operacional",
        "GIOM ainda nao substitui o ecossistema de IDE completions, PR review e agentes integrados do Copilot"
      ]
    )
  }
}

async function waitForServer(timeoutMs = 12000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${SERVER_URL}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // servidor ainda nao respondeu
    }

    await delay(500)
  }

  throw new Error("Servidor nao respondeu dentro do tempo limite")
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${SERVER_URL}${path}`, options)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Erro HTTP ${response.status} em ${path}`)
  }
  return payload
}

async function main() {
  const adminHeaders = process.env.ADMIN_DASH_KEY
    ? { "X-Admin-Key": process.env.ADMIN_DASH_KEY }
    : {}

  const child = spawn("node", [SERVER_ENTRY], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT)
    }
  })

  child.stdout.on("data", (chunk) => process.stdout.write(chunk))
  child.stderr.on("data", (chunk) => process.stderr.write(chunk))

  try {
    await waitForServer()

    const capabilitiesPayload = await fetchJson("/capabilities")
    const configPayload = await fetchJson("/config", {
      headers: {
        "X-User-Id": "giom_stack_audit"
      }
    })
    const capabilityMatrix = capabilitiesPayload?.capabilities?.sections
      ? capabilitiesPayload.capabilities
      : capabilitiesPayload

    const results = {}
    for (const packId of PACK_IDS) {
      results[packId] = await fetchJson("/evaluation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": "giom_stack_audit",
          ...adminHeaders
        },
        body: JSON.stringify({ packId })
      })
    }

    const profiles = Object.entries(PROFILE_SCENARIOS).map(([profileId, scenarioId]) => {
      const score = findTurnScore(results.profile_delivery_audit, scenarioId)
      return {
        id: profileId,
        percent: toPercent(score),
        score,
        level: scoreToLevel(score)
      }
    })

    const modules = Object.entries(MODULE_PACKS).map(([moduleId, packId]) => {
      const score = roundScore(results[packId]?.summary?.score || 0)
      return {
        id: moduleId,
        percent: toPercent(score),
        score,
        level: scoreToLevel(score)
      }
    })

    const capabilityFlags = collectCapabilityFlags(capabilityMatrix)
    const internalAxes = buildInternalAxes(results)
    const externalParity = buildExternalParity(results, capabilityFlags, internalAxes)

    const report = {
      generatedAt: new Date().toISOString(),
      runtime: {
        serverUrl: SERVER_URL,
        assistantName: configPayload?.branding?.assistantName || configPayload?.assistantName || "GIOM",
        provider: configPayload?.ai?.provider || configPayload?.ai?.providerMode || configPayload?.provider || "unknown",
        researchMode: configPayload?.ai?.research?.mode || configPayload?.research?.mode || configPayload?.researchMode || "local"
      },
      note: "Comparativos externos sao estimativas heuristicas baseadas em capacidades oficiais publicas e benchmarks internos do GIOM; nao sao testes head-to-head de laboratorio.",
      capabilitySummary: buildCapabilitySummary(capabilityMatrix),
      capabilityFlags,
      internalAxes: Object.fromEntries(
        Object.entries(internalAxes).map(([key, score]) => ([
          key,
          {
            score,
            percent: toPercent(score),
            level: scoreToLevel(score)
          }
        ]))
      ),
      benchmarkPacks: Object.fromEntries(
        Object.entries(results).map(([packId, payload]) => ([
          packId,
          {
            label: payload?.pack?.label || packId,
            score: roundScore(payload?.summary?.score || 0),
            percent: toPercent(payload?.summary?.score || 0),
            level: scoreToLevel(payload?.summary?.score || 0),
            status: payload?.summary?.status || "unknown",
            strengths: payload?.summary?.strengths || [],
            risks: payload?.summary?.risks || []
          }
        ]))
      ),
      profiles,
      modules,
      externalParity
    }

    await mkdir("reports", { recursive: true })
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2))

    console.log("GIOM stack audit OK")
    console.log(`Relatorio salvo em: ${REPORT_PATH}`)
    console.log("\nEixos internos:")
    Object.entries(report.internalAxes).forEach(([axisId, axis]) => {
      console.log(`- ${axisId}: ${axis.percent}% (${axis.level})`)
    })

    console.log("\nPerfis:")
    profiles.forEach((profile) => {
      console.log(`- ${profile.id}: ${profile.percent}% (${profile.level})`)
    })

    console.log("\nModulos:")
    modules.forEach((moduleItem) => {
      console.log(`- ${moduleItem.id}: ${moduleItem.percent}% (${moduleItem.level})`)
    })

    console.log("\nParidade externa estimada:")
    Object.entries(externalParity).forEach(([vendorId, vendor]) => {
      console.log(`- ${vendorId}: ${vendor.percent}% (${vendor.level})`)
    })
  } finally {
    child.kill("SIGTERM")
    await delay(500)
  }
}

main().catch((error) => {
  console.error("GIOM stack audit falhou:", error.message)
  process.exit(1)
})

import { detectIntent } from './utils/helpers.js'


// ======================================================
// GLOBAL STATE
// ======================================================

let lastStyle = "default"

const userProfileCache = {}



// ======================================================
// USER ID
// ======================================================

function getUserId(memory) {

  if (!memory) return "default_user"

  return (
    memory.userId ||
    memory.user_id ||
    memory.user ||
    "default_user"
  )

}



// ======================================================
// PROFILE ENGINE
// ======================================================

function getUserProfile(userId, memory) {

  if (!userProfileCache[userId]) {

    userProfileCache[userId] = {

      interactions: 0,
      personalityLevel: 1,
      knowledgeLevel: 1,
      reflectionLevel: 1,
      planningLevel: 1,

      styles: {},
      memoryHistory: [],

      dominantStyle: "default"

    }

  }

  if (memory?.personalityProfile) {

    userProfileCache[userId] = {
      ...userProfileCache[userId],
      ...memory.personalityProfile
    }

  }

  return userProfileCache[userId]

}


function saveProfile(userId, memory) {

  if (!memory) return

  memory.personalityProfile =
    userProfileCache[userId]

}



// ======================================================
// UPDATE PROFILE
// ======================================================

function updateProfile(
  userId,
  style,
  text,
  memory
) {

  const p =
    getUserProfile(userId, memory)

  p.interactions++

  p.styles[style] =
    (p.styles[style] || 0) + 1

  p.memoryHistory.push(text)

  if (p.memoryHistory.length > 20)
    p.memoryHistory.shift()


  p.personalityLevel =
    Math.min(5, 1 + Math.floor(p.interactions / 5))

  p.knowledgeLevel =
    Math.min(5, 1 + Math.floor(p.interactions / 8))

  p.reflectionLevel =
    Math.min(5, 1 + Math.floor(p.interactions / 10))

  p.planningLevel =
    Math.min(5, 1 + Math.floor(p.interactions / 12))


  saveProfile(userId, memory)

}



// ======================================================
// STYLE DETECTION
// ======================================================

function detectStyle(text) {

  const t = (text || "").toLowerCase()

  if (t.includes("erro") || t.includes("bug"))
    return "technical"

  if (t.includes("oi") || t.includes("mano"))
    return "casual"

  if (t.includes("explique"))
    return "chatgpt"

  if (t.includes("analise"))
    return "gemini"

  return "default"

}



// ======================================================
// V11 INTERPRETATION
// ======================================================

function interpret(text) {

  const t = (text || "").toLowerCase()

  return {

    question: t.includes("?"),
    fix: t.includes("erro") || t.includes("bug"),
    explain: t.includes("como"),
    analyze: t.includes("analise"),
    deep: t.includes("detalhado")

  }

}



// ======================================================
// V12 DOMAIN
// ======================================================

function detectDomain(text) {

  const t = (text || "").toLowerCase()

  if (t.includes("api")) return "backend"
  if (t.includes("css")) return "frontend"
  if (t.includes("sql")) return "database"
  if (t.includes("ia")) return "ai"

  return "general"

}



// ======================================================
// V15 PLAN
// ======================================================

function planResponse(text, profile) {

  if (profile.planningLevel < 2)
    return ""

  return "Planejando resposta...\n"

}



// ======================================================
// V16 THINK
// ======================================================

function think(profile) {

  if (profile.reflectionLevel < 2)
    return ""

  let t = ""

  if (profile.reflectionLevel >= 2)
    t += "Refletindo...\n"

  if (profile.reflectionLevel >= 3)
    t += "Analisando...\n"

  if (profile.reflectionLevel >= 4)
    t += "Pensando profundamente...\n"

  if (profile.reflectionLevel >= 5)
    t += "Raciocínio avançado ativo...\n"

  return t

}



// ======================================================
// V17 MULTI AGENT
// ======================================================

function chooseAgent(domain, interpretation) {

  if (interpretation.fix)
    return "debug-agent"

  if (interpretation.analyze)
    return "analysis-agent"

  if (domain === "backend")
    return "backend-agent"

  if (domain === "frontend")
    return "frontend-agent"

  if (domain === "database")
    return "db-agent"

  if (domain === "ai")
    return "ai-agent"

  return "general-agent"

}



// ======================================================
// V18 DECISION ENGINE
// ======================================================

function decideMode(profile, interpretation) {

  if (profile.knowledgeLevel >= 4)
    return "expert"

  if (interpretation.deep)
    return "deep"

  if (interpretation.explain)
    return "teacher"

  return "normal"

}



// ======================================================
// V19 EXPERT MODE
// ======================================================

function expertMode(profile) {

  if (profile.knowledgeLevel < 4)
    return ""

  return "Modo especialista ativo\n"

}



// ======================================================
// V20 RESEARCH MODE
// ======================================================

function research(profile) {

  if (profile.knowledgeLevel < 3)
    return ""

  return "Pesquisa interna ativada\n"

}



// ======================================================
// HEADER
// ======================================================

function header(style, profile) {

  return `🤖 Ai-GROOT V20

Estilo: ${style}
Nível: ${profile.personalityLevel}
Conhecimento: ${profile.knowledgeLevel}
Reflexão: ${profile.reflectionLevel}
Planejamento: ${profile.planningLevel}

`

}



// ======================================================
// MAIN RESPONSE
// ======================================================

export async function naturalResponse(
  response,
  intent = null,
  userText = "",
  memory = null
) {

  const userId =
    getUserId(memory)

  const profile =
    getUserProfile(userId, memory)

  const style =
    detectStyle(userText)

  const interpretation =
    interpret(userText)

  const domain =
    detectDomain(userText)

  updateProfile(
    userId,
    style,
    userText,
    memory
  )

  const plan =
    planResponse(userText, profile)

  const thinking =
    think(profile)

  const agent =
    chooseAgent(
      domain,
      interpretation
    )

  const mode =
    decideMode(
      profile,
      interpretation
    )

  const expert =
    expertMode(profile)

  const researchMode =
    research(profile)

  const head =
    header(style, profile)

  return `

${head}

${plan}
${thinking}
${expert}
${researchMode}

Agente: ${agent}
Modo: ${mode}
Domínio: ${domain}

${response}

Ai-GROOT V20 ativo

`

}
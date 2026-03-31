export function normalizeForIntent(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function extractPreferredUserName(context = {}) {
  const directCandidates = [
    context?.userName,
    context?.fullName,
    context?.name,
    context?.displayName,
    context?.user?.name,
    context?.user?.fullName,
    context?.profile?.name,
    context?.profile?.fullName
  ]

  for (const candidate of directCandidates) {
    const normalized = String(candidate || "").trim()
    if (normalized) {
      return normalized.split(/\s+/).slice(0, 2).join(" ")
    }
  }

  const email = String(context?.email || context?.user?.email || "").trim()
  if (email.includes("@")) {
    return email.split("@")[0].replace(/[._-]+/g, " ").trim()
  }

  return ""
}

export function detectGreetingSignals(question = "") {
  const raw = String(question || "").trim()
  const folded = normalizeForIntent(raw)
  const hasGreeting = /\b(bom dia|boa tarde|boa noite|oi+|ola|ol[aá]|e a[ií]|eai|salve|shalom|hey|ola+|ol[aá]+)\b/.test(folded)
  const hasWellBeing = /\b(tudo bem|como voce esta|como vai|como voce ta|como vc ta|como vc esta)\b/.test(folded)
  const nonGreetingIntent = /\b(explique|me explique|resolver|resolva|codigo|code|crie|gere|escreva|analisar|analise|traduz|calcule|pesquise|resuma|compare|passo a passo|roteiro|proposta|documento|imagem|video|mapa|tabela|timeline)\b/.test(folded)
  const wordCount = raw.split(/\s+/).filter(Boolean).length

  return {
    hasGreeting,
    hasWellBeing,
    isGreetingOnly: (hasGreeting || hasWellBeing) && !nonGreetingIntent && wordCount <= 20,
    folded
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function buildGreetingResponse(question = "", context = {}) {
  const { folded, hasWellBeing } = detectGreetingSignals(question)
  const name = extractPreferredUserName(context)
  const withName = name ? `, ${name}` : ""

  let opening = "Ola"
  if (folded.includes("bom dia")) opening = "Bom dia"
  if (folded.includes("boa tarde")) opening = "Boa tarde"
  if (folded.includes("boa noite")) opening = "Boa noite"
  if (folded.includes("shalom")) opening = "Shalom"

  if (hasWellBeing) {
    return pickRandom([
      `${opening}${withName}! Estou bem, gracas a Deus. E voce, como ta?`,
      `${opening}${withName}! Bem por aqui, gracas a Deus. E voce?`,
      `${opening}${withName}! Tudo certo, gracas a Deus. E voce, como esta se sentindo hoje?`,
      `${opening}${withName}! Bem sim, gracas a Deus. Como voce esta?`
    ])
  }

  if (opening === "Boa noite") {
    return pickRandom([
      `Boa noite${withName}! Que noite abencoada seja essa.`,
      `Boa noite${withName}! Que noite abencoada. No que posso ajudar?`,
      `Boa noite${withName}! Que noite abencoada ter voce aqui.`
    ])
  }

  if (opening === "Bom dia") {
    return pickRandom([
      `Bom dia${withName}! Tudo bem com voce?`,
      `Bom dia${withName}! Que seu dia comece bem.`,
      `Bom dia${withName}! Pronto para o que vier.`
    ])
  }

  if (opening === "Boa tarde") {
    return pickRandom([
      `Boa tarde${withName}! Tudo bem?`,
      `Boa tarde${withName}! Que bom te ver.`,
      `Boa tarde${withName}! No que posso ajudar?`
    ])
  }

  return pickRandom([
    `Oi${withName}! Tudo bem?`,
    `Ola${withName}! No que posso ajudar?`,
    `Oi${withName}! O que voce precisa hoje?`,
    `E ai${withName}! Tudo certo?`
  ])
}

export function buildGreetingLead(question = "", context = {}) {
  const { folded } = detectGreetingSignals(question)
  const name = extractPreferredUserName(context)
  const withName = name ? `, ${name}` : ""

  if (folded.includes("bom dia")) return pickRandom([
    `Bom dia${withName}!`,
    `Bom dia${withName}! Que seu dia seja bom.`,
    `Bom dia${withName}! Que alegria.`
  ])
  if (folded.includes("boa tarde")) return pickRandom([
    `Boa tarde${withName}!`,
    `Boa tarde${withName}! Que bom te ver.`,
    `Boa tarde${withName}! Por aqui.`
  ])
  if (folded.includes("boa noite")) return pickRandom([
    `Boa noite${withName}!`,
    `Boa noite${withName}! Que noite seja boa.`,
    `Boa noite${withName}! Vamos la.`
  ])
  if (folded.includes("shalom")) return `Shalom${withName}!`
  return pickRandom([`Oi${withName}!`, `Ola${withName}!`, `E ai${withName}!`])
}

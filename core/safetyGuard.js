// Safety Guard - respostas de apoio, prevencao e recusa segura

const SELF_HARM_PATTERNS = [
  /\b(suic(i|í)dio|me matar|me matar\?|quero morrer|tirar minha vida|me ferir)\b/i,
  /\b(self[-\s]?harm|kill myself|end my life|i want to die)\b/i
]

const VIOLENCE_PATTERNS = [
  /\b(matar|agredir|machucar|atirar|explodir|viol(ê|e)ncia)\b/i,
  /\b(kill|shoot|bomb|harm)\b/i
]

const ABUSE_PATTERNS = [
  /\b(abuso|abusado|ass(é|e)dio|viol(ê|e)ncia dom(é|e)stica)\b/i
]

const MENTAL_HEALTH_PATTERNS = [
  /\b(depress(a|ã)o|depressivo|ansiedade|p(â|a)n(i|í)co|triste demais|sem esperan(ç|c)a)\b/i
]

const SEXUAL_EXPLICIT_PATTERNS = [
  /\b(porn(o|ografia)?|nsfw|sexo expl[ií]cito|conte[uú]do adulto expl[ií]cito|erotico expl[ií]cito|nudes?)\b/i,
  /\b(explicit porn|adult explicit|sexual content explicit)\b/i
]

const SEXUAL_MINORS_PATTERNS = [
  /\b(crian(ç|c)a|menor de idade|adolescente|infantil)\b[\s\S]{0,40}\b(sexo|sexual|porn|nude|erot)\b/i,
  /\b(sexo|sexual|porn|nude|erot)\b[\s\S]{0,40}\b(crian(ç|c)a|menor de idade|adolescente|infantil)\b/i,
  /\b(child|minor|underage)\b[\s\S]{0,40}\b(sex|sexual|porn|nude)\b/i
]

const CRIME_PATTERNS = [
  /\b(como|quero|ensina|me ensine|ajude a)\b[\s\S]{0,30}\b(roubar|furtar|fraudar|golpear|falsificar|traficar|lavar dinheiro)\b/i,
  /\b(how to|teach me to|help me)\b[\s\S]{0,30}\b(steal|rob|fraud|forge|launder money|traffic)\b/i
]

const CYBER_ABUSE_PATTERNS = [
  /\b(como|quero|ensina|me ensine|ajude a)\b[\s\S]{0,30}\b(hackear|invadir|burlar|derrubar|roubar senha|clonar conta|phishing|malware|ransomware|keylogger)\b/i,
  /\b(how to|teach me to|help me)\b[\s\S]{0,30}\b(hack|breach|bypass|phish|steal credentials|deploy malware|ransomware|keylogger|ddos)\b/i
]

const DEFENSIVE_INTENT_PATTERNS = [
  /\b(proteger|previnir|prevenir|defender|detectar|mitigar|remediar|corrigir|auditar|denunciar|reportar|bloquear|analisar|explicar|estudar|historia|pesquisa|pesquisar)\b/i,
  /\b(protect|prevent|defend|detect|mitigate|remediate|audit|report|block|analyze|explain|study|history|research)\b/i
]

function hasDefensiveIntent(input = "") {
  return DEFENSIVE_INTENT_PATTERNS.some(pattern => pattern.test(input))
}

export function detectSafetyRisk(text = "") {
  const input = String(text || "")
  const defensiveIntent = hasDefensiveIntent(input)

  if (SELF_HARM_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: true, category: "self_harm", confidence: 0.9 }
  }

  if (SEXUAL_MINORS_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: true, category: "sexual_minors", confidence: 0.98 }
  }

  if (ABUSE_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: true, category: "abuse", confidence: 0.75 }
  }

  if (CYBER_ABUSE_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "cybersecurity_defense", confidence: 0.55 }
    }
    return { triggered: true, category: "cyber_abuse", confidence: 0.9 }
  }

  if (CRIME_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "crime_prevention", confidence: 0.55 }
    }
    return { triggered: true, category: "crime", confidence: 0.85 }
  }

  if (SEXUAL_EXPLICIT_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "sexual_health", confidence: 0.45 }
    }
    return { triggered: true, category: "sexual_explicit", confidence: 0.7 }
  }

  if (VIOLENCE_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: true, category: "violence", confidence: 0.6 }
  }

  if (MENTAL_HEALTH_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: false, advisory: true, category: "mental_health", confidence: 0.4 }
  }

  return { triggered: false, category: "none", confidence: 0 }
}

function buildPtResponse(safety) {
  if (safety.category === "self_harm") {
    return [
      "Sinto muito que voce esteja passando por isso. Eu me importo com sua seguranca.",
      "Se voce estiver em perigo imediato, procure ajuda local agora.",
      "Se puder, fale com alguem de confianca ou com um profissional de saude.",
      "Se quiser, posso ficar aqui com voce e ajudar a organizar os proximos passos com seguranca."
    ].join(" ")
  }

  if (safety.category === "abuse") {
    return [
      "Sinto muito que voce esteja vivendo isso. Voce nao esta sozinho.",
      "Se estiver em risco, procure ajuda local, um canal oficial ou alguem de confianca.",
      "Posso ajudar com orientacao geral, plano de seguranca e informacoes de apoio."
    ].join(" ")
  }

  if (safety.category === "violence") {
    return [
      "Nao posso ajudar com violencia.",
      "Se quiser, posso ajudar a desescalar a situacao, pensar em saidas seguras ou montar um plano de protecao."
    ].join(" ")
  }

  if (safety.category === "mental_health") {
    return [
      "Sinto muito que voce esteja passando por isso.",
      "Posso ajudar com apoio e informacoes gerais, mas nao substituo um profissional.",
      "Se puder, considere conversar com alguem de confianca ou buscar ajuda profissional."
    ].join(" ")
  }

  if (safety.category === "cybersecurity_defense") {
    return [
      "Posso ajudar com ciberseguranca em modo defensivo.",
      "Se quiser, explique o risco, sistema ou incidente e eu ajudo com prevencao, deteccao, hardening e resposta."
    ].join(" ")
  }

  if (safety.category === "crime_prevention") {
    return [
      "Posso ajudar com prevencao, conformidade, recuperacao e protecao.",
      "Explique o contexto e eu organizo medidas legais, defensivas e de seguranca."
    ].join(" ")
  }

  if (safety.category === "sexual_health") {
    return [
      "Posso ajudar com educacao sexual responsavel, saude, consentimento e seguranca.",
      "Nao ajudo com pornografia explicita."
    ].join(" ")
  }

  if (safety.category === "sexual_explicit") {
    return [
      "Nao posso ajudar com pornografia ou conteudo sexual explicito.",
      "Se quiser, posso ajudar com educacao sexual responsavel, consentimento, saude, relacionamentos ou seguranca online."
    ].join(" ")
  }

  if (safety.category === "sexual_minors") {
    return [
      "Nao posso ajudar com qualquer conteudo sexual envolvendo menores.",
      "Se houver risco real para uma crianca ou adolescente, procure imediatamente um responsavel, autoridade local ou canal oficial de protecao."
    ].join(" ")
  }

  if (safety.category === "crime") {
    return [
      "Nao posso ajudar com crimes, fraude, furto, falsificacao ou orientacoes para prejudicar terceiros.",
      "Posso ajudar com prevencao, seguranca, recuperacao, conformidade, etica e caminhos legais."
    ].join(" ")
  }

  if (safety.category === "cyber_abuse") {
    return [
      "Nao posso ajudar com invasao, phishing, malware, roubo de credenciais ou abuso cibernetico.",
      "Posso ajudar com defesa, hardening, auditoria, resposta a incidentes, deteccao e laboratorios seguros."
    ].join(" ")
  }

  return "Estou aqui para ajudar com seguranca e responsabilidade."
}

function buildEnResponse(safety) {
  if (safety.category === "self_harm") {
    return [
      "I am really sorry you are feeling this way. Your safety matters.",
      "If you are in immediate danger, please seek local emergency help.",
      "If you can, reach out to someone you trust or a health professional.",
      "I can stay here and help you think through safe next steps."
    ].join(" ")
  }

  if (safety.category === "abuse") {
    return [
      "I am sorry you are going through this. You are not alone.",
      "If you are at risk, please seek local help, an official channel, or someone you trust.",
      "I can provide general support and safety-planning information."
    ].join(" ")
  }

  if (safety.category === "violence") {
    return [
      "I cannot help with violence.",
      "If you want, I can help you think through safe de-escalation and protection steps."
    ].join(" ")
  }

  if (safety.category === "mental_health") {
    return [
      "I am sorry you are going through this.",
      "I can offer general support, but I am not a substitute for a professional.",
      "If you can, consider reaching out to someone you trust or a health professional."
    ].join(" ")
  }

  if (safety.category === "cybersecurity_defense") {
    return [
      "I can help with cybersecurity in a defensive way.",
      "Share the risk, system, or incident and I can help with prevention, detection, hardening, and response."
    ].join(" ")
  }

  if (safety.category === "crime_prevention") {
    return [
      "I can help with prevention, compliance, recovery, and lawful protection steps.",
      "Share the context and I will focus on safe and legal options."
    ].join(" ")
  }

  if (safety.category === "sexual_health") {
    return [
      "I can help with sexual health, consent, relationships, and safety.",
      "I cannot help with explicit pornography."
    ].join(" ")
  }

  if (safety.category === "sexual_explicit") {
    return [
      "I cannot help with pornographic or explicit sexual content.",
      "I can help with sexual health, consent, relationships, or online safety instead."
    ].join(" ")
  }

  if (safety.category === "sexual_minors") {
    return [
      "I cannot help with any sexual content involving minors.",
      "If a child or teenager may be at risk, please contact a trusted adult, local authority, or protection service immediately."
    ].join(" ")
  }

  if (safety.category === "crime") {
    return [
      "I cannot help with crimes, fraud, theft, forgery, or instructions to harm others.",
      "I can help with prevention, recovery, compliance, ethics, and lawful alternatives."
    ].join(" ")
  }

  if (safety.category === "cyber_abuse") {
    return [
      "I cannot help with hacking, phishing, malware, credential theft, or cyber abuse.",
      "I can help with defensive security, hardening, detection, incident response, and safe lab setups."
    ].join(" ")
  }

  return "I am here to help safely."
}

export function buildSafetyResponse(safety, context = {}) {
  const locale = context.locale || "pt"
  if (String(locale).toLowerCase().startsWith("pt")) {
    return buildPtResponse(safety)
  }
  return buildEnResponse(safety)
}

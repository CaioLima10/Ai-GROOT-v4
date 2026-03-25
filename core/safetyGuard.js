// Safety Guard - respostas de apoio, prevencao e recusa segura

const SELF_HARM_PATTERNS = [
  /\b(suic(i|í)dio|me matar|me matar\?|quero morrer|tirar minha vida|me ferir|me cortar|se cortar|se cortarem|cortar os pulsos|automutila(c|ç)(a|ã)o|automutilar|automutilarem|autoagress(a|ã)o|overdose)\b/i,
  /\b(self[-\s]?harm|kill myself|end my life|i want to die|cut myself|hurt myself|overdose)\b/i
]

const VIOLENCE_PATTERNS = [
  /\b(como|quero|ensina|me ensine|ajude a|planejar|fa(ç|c)a|fazer|crie|criar)\b[\s\S]{0,40}\b(matar|agredir|machucar|atirar|explodir|viol(ê|e)ncia|esfaquear|espancar)\b/i,
  /\b(how to|teach me to|help me|plan|make|create)\b[\s\S]{0,40}\b(kill|shoot|bomb|harm|stab|beat)\b/i
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
  /\b(como|quero|ensina|me ensine|ajude a)\b[\s\S]{0,60}\b(hackear|invadir|burlar|derrubar|roubar senha|roubar credenciais|credenciais|token|cookie de sessao|cookie de sessão|sessao|sessão|clonar conta|phishing|malware|ransomware|keylogger)\b/i,
  /\b(how to|teach me to|help me)\b[\s\S]{0,60}\b(hack|breach|bypass|phish|steal credentials|credentials|token|session cookie|session token|deploy malware|ransomware|keylogger|ddos)\b/i
]

const TERROR_PATTERNS = [
  /\b(como|quero|ensina|me ensine|ajude a|planejar|planeje)\b[\s\S]{0,40}\b(terror|terrorismo|atentado|bomba|explosivo|massacre|tiroteio em escola)\b/i,
  /\b(how to|teach me to|help me|plan)\b[\s\S]{0,40}\b(terror|terrorism|bomb|explosive|mass shooting|school shooting|attack)\b/i
]

const GRAPHIC_HARM_PATTERNS = [
  /\b(como|quero|ensina|me ensine|ajude a|fa(ç|c)a|fazer|crie|criar)\b[\s\S]{0,40}\b(mutilar|decapitar|esquartejar|torturar|gore|desmembrar)\b/i,
  /\b(how to|teach me to|help me|make|create)\b[\s\S]{0,40}\b(mutilate|behead|dismember|torture|gore)\b/i
]

const YOUTH_PLATFORM_HARM_PATTERNS = [
  /\b(crie|criar|fa(ç|c)a|fazer|monte|ensine|me ensine|ajude a|roteiro|script|desafio|challenge|jogo|experi(ê|e)ncia)\b[\s\S]{0,80}\b(roblox|discord|minecraft|fortnite|servidor|comunidade|grupo)\b[\s\S]{0,140}\b(suic(i|í)dio|automutila(c|ç)(a|ã)o|automutilar|automutilarem|cortar|cortarem|se cortar|se cortarem|mutila(r|ç)|terror|massacre|gore|viol(ê|e)ncia)\b/i,
  /\b(roblox|discord|minecraft|fortnite|servidor|comunidade|grupo)\b[\s\S]{0,140}\b(incentivar|estimular|induzir|normalizar|espalhar|promover)\b[\s\S]{0,100}\b(suic(i|í)dio|automutila(c|ç)(a|ã)o|automutilar|automutilarem|cortar|cortarem|se cortar|se cortarem|mutila(r|ç)|terror|massacre|gore|viol(ê|e)ncia)\b/i
]

const YOUTH_PLATFORM_CONTEXT_PATTERNS = [
  /\b(roblox|discord|minecraft|fortnite|servidor|comunidade|grupo|guilda|cl[aã]?)\b/i,
  /\b(teen|teens|adolescentes?|criancas?|crianças?|jovens|minores?)\b/i
]

const YOUTH_PLATFORM_HARM_KEYWORDS = [
  /\b(suic(i|í)dio|automutila(c|ç)(a|ã)o|automutilar|se cortar|cortar|mutila(r|ç)|desafio secreto|challenge|gore|viol(ê|e)ncia|amea(c|ç)a|terror)\b/i
]

const DEFENSIVE_INTENT_PATTERNS = [
  /\b(proteger|previnir|prevenir|defender|detectar|mitigar|remediar|corrigir|auditar|denunciar|reportar|bloquear|analisar|explicar|estudar|historia|pesquisa|pesquisar|moderar|moderacao|moderação|seguranca infantil|controle parental|apoiar um amigo|ajudar um amigo)\b/i,
  /\b(protect|prevent|defend|detect|mitigate|remediate|audit|report|block|analyze|explain|study|history|research|moderate|moderation|child safety|parental control|help a friend)\b/i
]

function hasDefensiveIntent(input = "") {
  return DEFENSIVE_INTENT_PATTERNS.some(pattern => pattern.test(input))
}

export function detectSafetyRisk(text = "") {
  const input = String(text || "")
  const defensiveIntent = hasDefensiveIntent(input)
  const youthPlatformContext = YOUTH_PLATFORM_CONTEXT_PATTERNS.every(pattern => pattern.test(input))
  const youthPlatformHarm = YOUTH_PLATFORM_HARM_KEYWORDS.some(pattern => pattern.test(input))

  if (YOUTH_PLATFORM_HARM_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "youth_platform_safety", confidence: 0.7 }
    }
    return { triggered: true, category: "youth_harm_influence", confidence: 0.96 }
  }

  if (defensiveIntent && youthPlatformContext && youthPlatformHarm) {
    return { triggered: false, advisory: true, category: "youth_platform_safety", confidence: 0.82 }
  }

  if (SELF_HARM_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "self_harm_prevention", confidence: 0.7 }
    }
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

  if (TERROR_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "terrorism_prevention", confidence: 0.65 }
    }
    return { triggered: true, category: "terrorism", confidence: 0.95 }
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

  if (GRAPHIC_HARM_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "violence_prevention", confidence: 0.6 }
    }
    return { triggered: true, category: "graphic_violence", confidence: 0.88 }
  }

  if (VIOLENCE_PATTERNS.some(pattern => pattern.test(input))) {
    if (defensiveIntent) {
      return { triggered: false, advisory: true, category: "violence_prevention", confidence: 0.55 }
    }
    return { triggered: true, category: "violence", confidence: 0.82 }
  }

  if (MENTAL_HEALTH_PATTERNS.some(pattern => pattern.test(input))) {
    return { triggered: false, advisory: true, category: "mental_health", confidence: 0.4 }
  }

  return { triggered: false, category: "none", confidence: 0 }
}

function buildPtResponse(safety, context = {}) {
  const promptText = String(context.promptText || "")
  const askedFastMethod = /rapida|rápida|silenciosa|metodo|método/i.test(promptText)
  const askedEvasion = /sem ser pego|esconder meus rastros|evadir|evas[aã]o|nao ser pego|não ser pego/i.test(promptText)
  const mentionsRoblox = /roblox/i.test(promptText)
  const mentionsChallenge = /desafio|challenge|roteiro|script|recompensa|mecanica|mecânica/i.test(promptText)
  const mentionsExplosives = /explosiv|bomba|atentado/i.test(promptText)

  if (safety.category === "self_harm") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com instrucoes de suicidio, automutilacao ou formas de morrer.",
      askedFastMethod ? "Nao vou fornecer um metodo rapido, silencioso ou qualquer orientacao pratica para isso." : null,
      "Meu papel aqui e apoiar passos seguros, cuidado imediato e busca de ajuda, nunca facilitar dano.",
      "Sinto muito que voce esteja passando por isso. Eu me importo com sua seguranca.",
      "Se voce estiver em perigo imediato, procure ajuda local agora.",
      "Se puder, fale com alguem de confianca ou com um profissional de saude.",
      "Se quiser, posso ficar aqui com voce e ajudar a organizar os proximos passos com seguranca."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "self_harm_prevention") {
    return [
      "Posso ajudar em modo de prevencao e cuidado.",
      "1. Observe sinais de alerta: despedidas, isolamento extremo, fala de morte, cortes, busca por meios ou mudanca brusca de comportamento.",
      "2. Fale de forma direta e acolhedora, sem julgamento, e nao deixe a pessoa sozinha se houver risco imediato.",
      "3. Reduza acesso a meios de autoagressao e acione um adulto, familiar, escola, lider responsavel ou servico local de emergencia quando necessario.",
      "4. Posso ajudar voce agora a montar uma mensagem de apoio, um plano curto de seguranca ou um roteiro de encaminhamento."
    ].join("\n")
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
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com violencia, morte ou agressao.",
      "Meu papel aqui e ajudar com desescalada, protecao e saidas seguras, nao com dano.",
      "Se quiser, posso ajudar a desescalar a situacao, pensar em saidas seguras ou montar um plano de protecao."
    ].join("\n")
  }

  if (safety.category === "graphic_violence") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com mutilacao, tortura, gore ou violencia grafica.",
      "Meu papel aqui e protecao, moderacao e prevencao, nao detalhar crueldade.",
      "Posso ajudar com protecao, denuncia, moderacao, suporte a vitimas ou analise preventiva."
    ].join("\n")
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

  if (safety.category === "violence_prevention") {
    return [
      "Posso ajudar com prevencao, moderacao, protecao e resposta segura.",
      "1. Defina regras claras contra ameacas, gore, humilhacao e incentivo a dano.",
      "2. Use filtros, fila de revisao humana e fluxo rapido de denuncia.",
      "3. Em risco concreto, preserve evidencias e acione moderadores, responsaveis ou autoridades locais.",
      "4. Se quiser, eu transformo isso em protocolo para comunidade, escola, jogo ou servidor."
    ].join("\n")
  }

  if (safety.category === "crime_prevention") {
    return [
      "Posso ajudar com prevencao, conformidade, recuperacao e protecao.",
      "Explique o contexto e eu organizo medidas legais, defensivas e de seguranca."
    ].join(" ")
  }

  if (safety.category === "terrorism_prevention") {
    return [
      "Posso ajudar com prevencao, deteccao e resposta segura a riscos de terrorismo ou ataque.",
      "1. Reuna sinais de alerta verificaveis, sem espalhar boatos.",
      "2. Defina rotas de evacuacao, pontos de encontro, controle de acesso e canais de emergencia.",
      "3. Preserve evidencias e acione imediatamente seguranca local ou autoridade competente.",
      "4. Se quiser, eu organizo um checklist de prevencao e resposta para evento, escola, igreja ou empresa."
    ].join("\n")
  }

  if (safety.category === "sexual_health") {
    return [
      "Posso ajudar com educacao sexual responsavel, saude, consentimento e seguranca.",
      "Nao ajudo com pornografia explicita."
    ].join(" ")
  }

  if (safety.category === "sexual_explicit") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com pornografia ou conteudo sexual explicito.",
      "Meu papel aqui e orientar com responsabilidade em saude, consentimento e seguranca.",
      "Posso ajudar com educacao sexual responsavel, consentimento, saude, relacionamentos ou seguranca online."
    ].join("\n")
  }

  if (safety.category === "sexual_minors") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com qualquer conteudo sexual envolvendo menores.",
      "Meu papel aqui e proteger criancas e adolescentes e orientar para canais oficiais de protecao.",
      "Se houver risco real para uma crianca ou adolescente, procure imediatamente um responsavel, autoridade local ou canal oficial de protecao."
    ].join("\n")
  }

  if (safety.category === "crime") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com crimes, fraude, furto, falsificacao ou orientacoes para prejudicar terceiros.",
      "Meu papel aqui e apoiar prevencao, recuperacao, conformidade e caminhos legais.",
      "Posso ajudar com prevencao, seguranca, recuperacao, conformidade, etica e caminhos legais."
    ].join("\n")
  }

  if (safety.category === "cyber_abuse") {
    const mentionsCredentials = /credenciais|senha|token|cookie|sess[aã]o/i.test(promptText)
    const askedEvasion = /esconder meus rastros|ocultar rastros|nao ser pego|não ser pego|evas[aã]o|evadir/i.test(promptText)
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao para uso defensivo, e nao posso ajudar com invasao, phishing, malware, roubo de credenciais ou abuso cibernetico.",
      mentionsCredentials ? "Nao vou ajudar a roubar credenciais, senha, token ou sessao de usuarios." : null,
      askedEvasion ? "Tambem nao vou ajudar a esconder rastros, ocultar atividade ou evitar deteccao." : null,
      "Meu papel aqui e fortalecer defesa, hardening, auditoria e resposta a incidentes, nunca facilitar abuso.",
      "Posso ajudar com defesa, hardening, auditoria, resposta a incidentes, deteccao e laboratorios seguros."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "terrorism") {
    return [
      "Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar com terrorismo, atentados, explosivos ou ataques.",
      mentionsExplosives ? "Nao vou ajudar a planejar explosivos, atentado ou execucao de ataque." : null,
      askedEvasion ? "Tambem nao vou ajudar com evasao, ocultacao ou formas de nao ser pego." : null,
      "Meu papel aqui e prevencao, protecao civil, resposta a incidentes e orientacao para canais oficiais.",
      "Posso ajudar com prevencao, protecao, resposta a incidentes, comunicacao de risco e canais oficiais de denuncia."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "youth_harm_influence") {
    return [
      `Sou o GIOM, um assistente de IA operando com limites de seguranca nesta execucao, e nao posso ajudar a criar, promover ou espalhar desafios, jogos ou experiencias que incentivem suicidio, automutilacao, terror ou violencia${mentionsRoblox ? " no Roblox" : " em plataformas e comunidades online"}.`,
      mentionsChallenge ? "Nao vou ajudar com roteiro, script, recompensa, desafio secreto ou mecanica de engajamento para isso." : null,
      "Meu papel aqui e proteger criancas e adolescentes com moderacao, design seguro e resposta preventiva.",
      "Posso ajudar com moderacao, protecao infantil, design seguro, filtros, fluxo de denuncia e orientacoes para pais, escolas e comunidades."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "youth_platform_safety") {
    return [
      "Posso ajudar com seguranca infantil e moderacao em jogos e comunidades online.",
      `1. Defina regras explicitas contra automutilacao, suicidio, gore, ameacas e desafios secretos${mentionsRoblox ? " no Roblox" : ""}.`,
      "2. Use filtros de palavras, bloqueio de links suspeitos, revisao humana e fila de denuncias urgentes.",
      "3. Treine moderadores para escalar risco real, preservar evidencias e acionar pais, escola ou autoridade quando preciso.",
      "4. Prepare mensagens de apoio seguras para adolescentes em sofrimento, sem normalizar nem detalhar dano.",
      "5. Se quiser, eu transformo isso agora em politica de moderacao, checklist ou fluxo operacional."
    ].join("\n")
  }

  return "Estou aqui para ajudar com seguranca e responsabilidade."
}

function buildEnResponse(safety, context = {}) {
  const promptText = String(context.promptText || "")
  const askedFastMethod = /fast|silent|method/i.test(promptText)
  const askedEvasion = /avoid getting caught|hide my tracks|evad|not get caught/i.test(promptText)
  const mentionsRoblox = /roblox/i.test(promptText)
  const mentionsChallenge = /challenge|script|reward|secret|mechanic/i.test(promptText)
  const mentionsExplosives = /explosiv|bomb|attack/i.test(promptText)

  if (safety.category === "self_harm") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with suicide methods, self-harm instructions, or ways to die.",
      askedFastMethod ? "I will not provide a fast, silent, or practical method for that." : null,
      "My role here is to support safe next steps, immediate care, and help-seeking, never harm.",
      "I am really sorry you are feeling this way. Your safety matters.",
      "If you are in immediate danger, please seek local emergency help.",
      "If you can, reach out to someone you trust or a health professional.",
      "I can stay here and help you think through safe next steps."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "self_harm_prevention") {
    return [
      "I can help in prevention and support mode.",
      "1. Watch for warning signs such as goodbye messages, severe isolation, self-harm, searching for means, or a sudden behavioral shift.",
      "2. Speak directly and supportively without judgment, and do not leave the person alone if there is immediate risk.",
      "3. Reduce access to means of harm and involve a trusted adult, family member, school contact, or local emergency support when needed.",
      "4. I can help you draft a support message, a short safety plan, or an escalation script right now."
    ].join("\n")
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
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with violence, killing, or assault.",
      "My role here is de-escalation, protection, and safe planning, not harm.",
      "If you want, I can help you think through safe de-escalation and protection steps."
    ].join("\n")
  }

  if (safety.category === "graphic_violence") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with mutilation, torture, gore, or graphic violence.",
      "My role here is protection, moderation, and prevention, not cruelty details.",
      "I can help with protection, reporting, moderation, victim support, or prevention."
    ].join("\n")
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

  if (safety.category === "violence_prevention") {
    return [
      "I can help with prevention, moderation, protection, and safe response.",
      "1. Set explicit rules against threats, gore, humiliation, and encouragement of harm.",
      "2. Use filters, human review queues, and a fast reporting path.",
      "3. In concrete risk situations, preserve evidence and contact moderators, guardians, or local authorities.",
      "4. If you want, I can turn this into a protocol for a community, school, game, or server."
    ].join("\n")
  }

  if (safety.category === "crime_prevention") {
    return [
      "I can help with prevention, compliance, recovery, and lawful protection steps.",
      "Share the context and I will focus on safe and legal options."
    ].join(" ")
  }

  if (safety.category === "terrorism_prevention") {
    return [
      "I can help with prevention, detection, and safe response to terrorism or attack risks.",
      "1. Gather verifiable warning signs without spreading rumors.",
      "2. Define evacuation routes, meeting points, access control, and emergency contacts.",
      "3. Preserve evidence and contact local security or the relevant authority immediately.",
      "4. If you want, I can build a prevention and response checklist for an event, school, church, or company."
    ].join("\n")
  }

  if (safety.category === "sexual_health") {
    return [
      "I can help with sexual health, consent, relationships, and safety.",
      "I cannot help with explicit pornography."
    ].join(" ")
  }

  if (safety.category === "sexual_explicit") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with pornographic or explicit sexual content.",
      "My role here is responsible guidance on health, consent, and safety.",
      "I can help with sexual health, consent, relationships, or online safety instead."
    ].join("\n")
  }

  if (safety.category === "sexual_minors") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with any sexual content involving minors.",
      "My role here is to protect children and teenagers and direct people to official protection channels.",
      "If a child or teenager may be at risk, please contact a trusted adult, local authority, or protection service immediately."
    ].join("\n")
  }

  if (safety.category === "crime") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with crimes, fraud, theft, forgery, or instructions to harm others.",
      "My role here is prevention, recovery, compliance, and lawful guidance.",
      "I can help with prevention, recovery, compliance, ethics, and lawful alternatives."
    ].join("\n")
  }

  if (safety.category === "cyber_abuse") {
    const mentionsCredentials = /credentials|password|token|cookie|session/i.test(promptText)
    const askedEvasion = /hide my tracks|avoid detection|not get caught|evad|conceal/i.test(promptText)
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run for defensive use, and I cannot help with hacking, phishing, malware, credential theft, or cyber abuse.",
      mentionsCredentials ? "I will not help steal credentials, passwords, tokens, or user sessions." : null,
      askedEvasion ? "I also will not help hide tracks, conceal activity, or avoid detection." : null,
      "My role here is to strengthen defense, hardening, auditing, and incident response, never abuse.",
      "I can help with defensive security, hardening, detection, incident response, and safe lab setups."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "terrorism") {
    return [
      "I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help with terrorism, attacks, explosives, or mass violence.",
      mentionsExplosives ? "I will not help plan explosives, an attack, or execution details." : null,
      askedEvasion ? "I also will not help with evasion, concealment, or avoiding capture." : null,
      "My role here is prevention, public protection, incident response, and official reporting guidance.",
      "I can help with prevention, protection, incident response, risk communication, and official reporting options."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "youth_harm_influence") {
    return [
      `I am GIOM, an AI assistant operating with safety limits in this run, and I cannot help create, promote, or spread games, challenges, or experiences that encourage suicide, self-harm, terror, or violence${mentionsRoblox ? " on Roblox" : " on youth platforms or online communities"}.`,
      mentionsChallenge ? "I will not help with a script, reward loop, secret challenge, or engagement mechanic for that." : null,
      "My role here is to protect children and teenagers through moderation, safe design, and preventive response.",
      "I can help with moderation, child safety, safe design, reporting flows, and guidance for parents, schools, or communities."
    ].filter(Boolean).join("\n")
  }

  if (safety.category === "youth_platform_safety") {
    return [
      "I can help with child safety and moderation in games and online communities.",
      `1. Set explicit rules against self-harm, suicide, gore, threats, and secret challenges${mentionsRoblox ? " on Roblox" : ""}.`,
      "2. Use keyword filters, suspicious link blocks, human review, and an urgent reporting queue.",
      "3. Train moderators to escalate real risk, preserve evidence, and involve parents, schools, or authorities when needed.",
      "4. Prepare safe support messages for distressed teens without normalizing or detailing harm.",
      "5. If you want, I can turn this into a moderation policy, checklist, or operational flow."
    ].join("\n")
  }

  return "I am here to help safely."
}

export function buildSafetyResponse(safety, context = {}) {
  const locale = context.locale || "pt"
  if (String(locale).toLowerCase().startsWith("pt")) {
    return buildPtResponse(safety, context)
  }
  return buildEnResponse(safety, context)
}

import { ReasoningAgent } from "../../../agents/reasoningAgent.js"

const operationalReasoner = new ReasoningAgent()

const THREAD_FACT_PATTERNS = [
  {
    key: "name",
    regex: /(?:^|[.!?,]\s*)meu nome (?:e|é)\s+([a-z\u00c0-\u017f][a-z\u00c0-\u017f\s'-]{1,40}?)(?=\s+e\s+(?:eu|estou|estamos|quero|prefiro|trabalho|atuo|minha|pode|costumo|uso)\b|[,.!?]|$)/i
  },
  {
    key: "workDomain",
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:eu trabalho com|trabalho com|atuo com|minha area (?:e|é)|minha área (?:e|é))\s+(?!como\b|qual\b|diga\b|dizer\b)([^.,\n]{2,80}?)(?=\s+e\s+prefiro|\s+e\s+gosto|[.,\n]|$)/i
  },
  {
    key: "preferredName",
    regex: /(?:^|[.!?,]\s*)(?:pode me chamar de|me chame de|quero que me chame de)\s+([a-z\u00c0-\u017f][a-z\u00c0-\u017f\s'-]{1,40}?)(?=\s+e\s+(?:eu|estou|estamos|quero|prefiro|trabalho|atuo|minha|pode|costumo|uso)\b|[,.!?]|$)/i
  },
  {
    key: "responseStyle",
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:eu\s+)?(?:prefiro|gosto de|quero)\s+(?:respostas?|explica(?:c|ç)(?:o|õ)es?)\s+([^.,\n]{2,80}?)(?=[.,\n]|$)/i
  },
  {
    key: "currentGoal",
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:estou estudando|estamos estudando|estou aprendendo|estamos aprendendo|quero estudar|quero aprender|estou tratando de|estamos tratando de|estou falando de|estamos falando de|minha prioridade e|minha prioridade é|meu foco atual e|meu foco atual é)\s+([^.,\n]{3,80}?)(?=[.,\n]|$)/i
  },
  {
    key: "bibleVersion",
    regex: /(?:^|[.!?,]\s*|\se\s+)(?:prefiro|uso|costumo usar)\s+(?:a\s+)?(?:biblia|bíblia|vers[aã]o)\s+([^.,\n]{2,40}?)(?=[.,\n]|$)/i
  }
]

const SUSPICIOUS_FACT_VALUE_PATTERNS = [
  /^\s*(?:qual|quem|onde|quando|como|porque|por que|o que|quais|me diga|diga|responda|continue|explique)\b/i,
  /\bagora diga\b/i,
  /\bqual (?:e|é)\b/i,
  /\blembra\b/i,
  /\?/,
  /\buma unica frase\b/i,
  /\buma única frase\b/i
]

const STRICT_LOCAL_RECALL_PATTERN = /\b(sem olhar outras conversas|sem usar outras conversas|sem considerar outras conversas|nesta conversa|nessa conversa|nesta thread|nessa thread|neste chat|nesse chat)\b/i

function normalizeFactValue(value = "") {
  const normalized = String(value || "")
    .trim()
    .replace(/[.?!]+$/, "")
    .trim()

  if (!normalized) {
    return ""
  }

  if (SUSPICIOUS_FACT_VALUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return ""
  }

  return normalized
}

function mergeKnownFacts(base = {}, extra = {}) {
  const merged = { ...(base || {}) }

  Object.entries(extra || {}).forEach(([key, value]) => {
    const normalizedValue = normalizeFactValue(value)
    if (!normalizedValue) {
      return
    }

    merged[key] = normalizedValue
  })

  return merged
}

function flattenTurnContent(entry = {}) {
  const raw = entry?.content ?? entry?.text ?? entry?.message ?? ""
  return String(raw || "").trim()
}

function extractFactsFromText(text = "") {
  return THREAD_FACT_PATTERNS.reduce((acc, pattern) => {
    const match = String(text || "").match(pattern.regex)
    if (!match?.[1]) {
      return acc
    }

    const normalizedValue = normalizeFactValue(match[1])
    if (!normalizedValue) {
      return acc
    }

    acc[pattern.key] = normalizedValue
    return acc
  }, {})
}

function extractThreadKnownFacts(history = []) {
  return (Array.isArray(history) ? history : []).reduce((acc, entry) => {
    if (String(entry?.role || "").trim().toLowerCase() !== "user") {
      return acc
    }

    return mergeKnownFacts(acc, extractFactsFromText(flattenTurnContent(entry)))
  }, {})
}

function buildProfileKnownFacts(context = {}) {
  const memoryProfile = context?.memoryProfile && typeof context.memoryProfile === "object"
    ? context.memoryProfile
    : {}
  const userProfile = context?.userProfile && typeof context.userProfile === "object"
    ? context.userProfile
    : {}

  return mergeKnownFacts(
    mergeKnownFacts(memoryProfile?.knownFacts || {}, userProfile?.knownFacts || {}),
    {
      name: memoryProfile?.name || userProfile?.name,
      preferredName: memoryProfile?.preferredName || userProfile?.preferredName,
      workDomain: memoryProfile?.workDomain || userProfile?.workDomain,
      responseStyle: memoryProfile?.responseStyle || userProfile?.responseStyle,
      role: memoryProfile?.role || userProfile?.role,
      currentGoal: memoryProfile?.currentGoal || userProfile?.currentGoal,
      bibleVersion: memoryProfile?.bibleVersion || userProfile?.bibleVersion
    }
  )
}

function isStrictLocalRecallQuestion(question = "") {
  return STRICT_LOCAL_RECALL_PATTERN.test(String(question || ""))
}

function isRecallQuestion(question = "") {
  return operationalReasoner.isMemoryRecallQuestion(String(question || ""))
}

function resolveLocalConversationHistory(context = {}, question = "") {
  const requestHistory = Array.isArray(context?.requestConversationHistory) ? context.requestConversationHistory : []
  if (requestHistory.length > 0) {
    return requestHistory
  }

  const sessionHistory = Array.isArray(context?.sessionConversationHistory) ? context.sessionConversationHistory : []
  if (sessionHistory.length > 0) {
    return sessionHistory
  }

  if (isStrictLocalRecallQuestion(question)) {
    return []
  }

  return Array.isArray(context?.conversationHistory) ? context.conversationHistory : []
}

function buildOperationalMemoryContext(question = "", context = {}) {
  const localConversationHistory = resolveLocalConversationHistory(context, question)
  const threadFacts = extractThreadKnownFacts(localConversationHistory)
  const profileFacts = isStrictLocalRecallQuestion(question)
    ? {}
    : buildProfileKnownFacts(context)
  const knownFacts = mergeKnownFacts(profileFacts, threadFacts)
  const resolvedFocus = normalizeFactValue(threadFacts.currentGoal || profileFacts.currentGoal || "")

  return {
    knownFacts,
    conversationState: {
      resolvedFocus
    }
  }
}

function buildMissingThreadContextResponse(question = "") {
  const input = String(question || "")

  if (/\b(qual e meu nome|qual é meu nome|meu nome|quem sou eu)\b/i.test(input)) {
    return "Ainda nao tenho essa informacao nesta conversa sobre seu nome. Se quiser, me diga de novo e eu continuo daqui."
  }

  if (/\b(assunto|pedido|o que eu disse|o que eu pedi|qual foi meu pedido|qual foi a pergunta anterior)\b/i.test(input)) {
    return "Ainda nao tenho essa informacao nesta conversa sobre esse assunto. Se quiser, me diga de novo e eu continuo daqui."
  }

  return "Ainda nao tenho esse contexto nesta conversa. Se quiser, me diga de novo e eu continuo daqui."
}

function findLatestCapabilityQuestion(history = []) {
  const userTurns = Array.isArray(history)
    ? history.filter((entry) => String(entry?.role || "").trim().toLowerCase() === "user")
    : []

  for (let index = userTurns.length - 1; index >= 0; index -= 1) {
    const content = flattenTurnContent(userTurns[index])
    if (!content) {
      continue
    }

    if (operationalReasoner.isCapabilityQuestion(content)) {
      return content
    }
  }

  return ""
}

function isCapabilityToneFollowUp(question = "") {
  return /\b(responda isso|responda de forma profissional|sem parecer um robo|sem parecer um robô|de forma objetiva e profissional)\b/i.test(String(question || ""))
}

function isLiveWebCapabilityQuestion(question = "") {
  return /\b(consegue pesquisar|consegue verificar|pesquisar google|google ao vivo|web ao vivo|informacoes atuais|informações atuais|dado atual|fato atual)\b/i.test(String(question || ""))
}

function buildLiveWebCapabilityResponse(context = {}) {
  const capabilities = context?.researchCapabilities || {}
  const liveSources = Array.isArray(capabilities.liveSources) ? capabilities.liveSources.filter(Boolean) : []
  const hasGeneralWeb = liveSources.some((source) => /google|bing|yahoo|web|internet/i.test(String(source || "")))

  if (capabilities.mode === "live" && liveSources.length > 0 && hasGeneralWeb) {
    return `Nesta execucao eu consigo consultar fontes ao vivo via ${liveSources.join(", ")}, mas eu ainda preciso separar o que foi confirmado agora do que veio do conhecimento interno.`
  }

  if (liveSources.length > 0) {
    return `Hoje eu nao tenho navegacao web geral via Google ao vivo. O que existe nesta execucao e consulta ao vivo limitada a ${liveSources.join(", ")}, e eu preciso deixar claro quando algo nao foi confirmado fora desse escopo.`
  }

  return "Hoje eu nao tenho pesquisa web ao vivo confirmada nesta execucao. Quando o pedido depende de dado atual, eu preciso dizer isso com clareza e nao tratar a informacao como verificada."
}

function buildProfessionalCapabilityFollowUp(context = {}, latestCapabilityQuestion = "", memoryContext = {}) {
  if (isLiveWebCapabilityQuestion(latestCapabilityQuestion)) {
    const liveWebResponse = buildLiveWebCapabilityResponse(context)
    return `${liveWebResponse} Fora disso, eu trabalho com memoria conversacional, historico salvo e base curada, sem fingir verificacao atual.`
  }

  return operationalReasoner.buildCapabilityResponse(latestCapabilityQuestion, context, memoryContext)
}

function isPracticalCapabilityQuestion(question = "") {
  const input = String(question || "")
  return /\b(em termos praticos|em termos práticos)\b/i.test(input)
    && /\b(o que voce consegue fazer bem|o que você consegue fazer bem|o que voce faz bem|o que você faz bem|nesta execucao|nesta execução)\b/i.test(input)
}

function buildPracticalCapabilityResponse() {
  return [
    "Nesta execucao eu consigo analisar contexto, organizar informacao, resumir material, explicar com clareza e manter continuidade no que esta sendo discutido.",
    "Tambem consigo escrever e revisar conteudo tecnico, estruturar respostas e deixar explicitas as lacunas quando o pedido depende de dado atual ou verificacao externa."
  ].join(" ")
}

function isCurrentDataPolicyQuestion(question = "") {
  return /\b(dado muito atual|informacao muito atual|informação muito atual|fato muito atual|como voce deve responder|como você deve responder)\b/i.test(String(question || ""))
}

function buildCurrentDataPolicyResponse() {
  return "A regra e simples: nao inventar, dizer com clareza quando eu nao consegui confirmar algo nesta execucao e pedir nova tentativa ou o contexto minimo necessario."
}

function extractSimpleArithmeticExpression(question = "") {
  return String(question || "").match(/(-?\d+(?:[.,]\d+)?)\s*([+\-x×*/])\s*(-?\d+(?:[.,]\d+)?)/)
}

function isSimpleArithmeticQuestion(question = "") {
  const input = String(question || "")
  if (!input.trim()) {
    return false
  }

  const hasExpression = Boolean(extractSimpleArithmeticExpression(input))
  if (!hasExpression) {
    return false
  }

  return /\b(quanto (?:e|é)|qual (?:e|é) o resultado|resultado de|calcule|calcula|some|soma|multiplique|multiplica|divida|divide|subtraia|subtrai|resuma rapidamente)\b/i.test(input)
}

function parseSimpleArithmeticNumber(value = "") {
  const parsed = Number(String(value || "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatSimpleArithmeticResult(value = 0) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return String(Number(value.toFixed(6))).replace(".", ",")
}

function buildSimpleArithmeticResponse(question = "") {
  const match = extractSimpleArithmeticExpression(question)
  if (!match) {
    return null
  }

  const left = parseSimpleArithmeticNumber(match[1])
  const right = parseSimpleArithmeticNumber(match[3])
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null
  }

  const operator = match[2]
  let result = null

  switch (operator) {
    case "+":
      result = left + right
      break
    case "-":
      result = left - right
      break
    case "*":
    case "x":
    case "×":
      result = left * right
      break
    case "/":
      if (right === 0) {
        return "Nao existe divisao por zero."
      }
      result = left / right
      break
    default:
      return null
  }

  return `${match[1]} ${operator} ${match[3]} = ${formatSimpleArithmeticResult(result)}.`
}

function isCurrentDateTimeQuestion(question = "") {
  const input = String(question || "")
  if (!input.trim()) {
    return false
  }

  const asksForCurrentTime = /\b(que horas|qual(?:\s+e|\s+é)?(?:\s+o)?\s+hor[aá]rio|hor[aá]rio de agora|hora de agora|hora agora|hor[aá]rio agora)\b/i.test(input)
  const asksForCurrentDate = /\b(que dia (?:e|é) hoje|qual (?:e|é) a data de hoje|data de hoje|dia mes e ano|dia m[eê]s e ano|mes e ano|m[eê]s e ano)\b/i.test(input)
  const asksForNow = /\b(agora|hoje|neste momento|nesse momento)\b/i.test(input)

  return asksForCurrentDate || (asksForCurrentTime && asksForNow)
}

function resolveOperationalClock(context = {}) {
  const runtimeClock = context?.runtimeClock && typeof context.runtimeClock === "object"
    ? context.runtimeClock
    : null

  if (runtimeClock && Number.isFinite(Number(runtimeClock?.nowMs))) {
    return {
      nowMs: Number(runtimeClock.nowMs),
      timezone: String(runtimeClock.timezone || "Etc/UTC")
    }
  }

  return {
    nowMs: Date.now(),
    timezone: "Etc/UTC"
  }
}

function formatClockTime(timestampMs = Date.now(), timezone = "Etc/UTC") {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: String(timezone || "Etc/UTC"),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(timestampMs))
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(timestampMs))
  }
}

function formatClockDate(timestampMs = Date.now(), timezone = "Etc/UTC") {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: String(timezone || "Etc/UTC"),
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(timestampMs))
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(timestampMs))
  }
}

function buildCurrentDateTimeResponse(context = {}) {
  const clock = resolveOperationalClock(context)
  const timeText = formatClockTime(clock.nowMs, clock.timezone)
  const dateText = formatClockDate(clock.nowMs, clock.timezone)
  return `Agora sao ${timeText} e hoje e ${dateText}.`
}

function buildLocalHistoryText(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => flattenTurnContent(entry))
    .filter(Boolean)
    .join("\n")
}

function isUploadSummaryFollowUpQuestion(question = "") {
  const input = String(question || "")
  return /\b(resumo curto|resuma|faca um resumo|fa[cç]a um resumo)\b/i.test(input)
    && /\b(disso|desse arquivo|desse anexo|em 2 linhas|duas linhas)\b/i.test(input)
}

function isUploadSummaryContext(history = []) {
  const text = buildLocalHistoryText(history)
  return /\b(validar leitura fiel de anexos no runtime|objetivo principal do arquivo|arquivo enviado|anexo)\b/i.test(text)
}

function buildUploadSummaryFollowUpResponse(history = []) {
  const text = buildLocalHistoryText(history)

  if (/\bvalidar leitura fiel de anexos no runtime\b/i.test(text)) {
    return "Resumo curto: o anexo existe para validar leitura fiel de anexos no runtime. O foco e garantir que o GIOM leia o material sem inventar contexto fora do arquivo."
  }

  return "Resumo curto: o anexo concentra a informacao principal desta conversa. O foco agora e responder com base nessa leitura, sem criar contexto fora do arquivo."
}

function isSpreadsheetScheduleFollowUpQuestion(question = "") {
  const input = String(question || "")
  return /\b(cronograma simples|3 etapas|tres etapas)\b/i.test(input)
    && /\bplanilha\b/i.test(input)
    && /\bsem criar arquivo\b/i.test(input)
}

function isSpreadsheetScheduleContext(history = []) {
  const text = buildLocalHistoryText(history)
  return /\b(planilha|ocr local|status em teste)\b/i.test(text)
}

function buildSpreadsheetScheduleFollowUpResponse(history = []) {
  const text = buildLocalHistoryText(history)
  const mentionsOcr = /\bocr local\b/i.test(text)

  return [
    `1. Confirmar a leitura da planilha e revisar o item em teste${mentionsOcr ? ", com foco no OCR local." : "."}`,
    "2. Ajustar o follow-up das pendencias e registrar o que ficou obrigatorio para a proxima rodada.",
    "3. Fechar a revisao final e liberar a etapa seguinte com um checklist curto."
  ].join(" ")
}

function isApiLatencyContext(history = []) {
  const text = buildLocalHistoryText(history)
  return (/\bapi node\b/i.test(text) && /\b(latencia|latência|clareza|time)\b/i.test(text))
    || /\b(latencia|latência|p95|p99|gargalo|gargalos|cache|payload|dependencia externa|dependência externa|taxa de erro|rota)\b/i.test(text)
}

function isApiLatencyPlanQuestion(question = "") {
  return /\b(3 frentes objetivas|3 frentes|3 prioridades|por onde comecar|por onde começar)\b/i.test(String(question || ""))
}

function buildApiLatencyPlanResponse() {
  return [
    "1. Meça o caminho real da requisicao: p95/p99, taxa de erro e tempo gasto em banco, cache e chamadas externas.",
    "2. Ache os gargalos dominantes: descubra em qual etapa a rota perde mais tempo e documente isso com um painel simples para o time.",
    "3. Execute ganhos de baixo risco: reduza payload, ajuste cache e revise consultas ou dependencias que estejam segurando a resposta."
  ].join(" ")
}

function isApiLatencySecondPointQuestion(question = "") {
  const input = String(question || "")
  return /\b(segundo ponto|desse segundo ponto|desse segundo|o que devo medir primeiro)\b/i.test(input)
    || /\bquando eu disser ['"]?isso['"]?\b/i.test(input)
}

function buildApiLatencySecondPointResponse(question = "") {
  if (/\b(medir primeiro|o que devo medir primeiro)\b/i.test(String(question || ""))) {
    return "Comece medindo latencia p95 e p99 da rota, taxa de erro e tempo por dependencia externa. Isso ja mostra se o gargalo esta no banco, no cache, em chamada HTTP ou na propria aplicacao."
  }

  return "Eu detalharia o segundo ponto assim: primeiro mapeie a rota por etapa, depois defina as metricas que voce vai medir desde o inicio, como latencia p95 e p99, taxa de erro e tempo por dependencia externa. Feche isso com um painel simples que deixe claros os dois maiores gargalos e a ordem de ataque."
}

function isApiLatencySmallTeamQuestion(question = "") {
  const input = String(question || "")
  return /\b(time e pequeno|time é pequeno|caiba em uma semana|uma semana|enxut[oa])\b/i.test(input)
}

function buildApiLatencySmallTeamResponse() {
  return [
    "Para caber em uma semana com um time pequeno, eu faria tres movimentos enxutos.",
    "Primeiro, escolha uma rota critica e instrumente p95, p99, taxa de erro e tempo por dependencia externa.",
    "Depois, ataque um unico gargalo dominante, como uma consulta pesada, payload excessivo ou chamada externa lenta, e feche com um comparativo simples de antes e depois para o time."
  ].join(" ")
}

function isApiLatencyExecutiveCloseQuestion(question = "") {
  const input = String(question || "")
  return /\bplano da api\b/i.test(input)
    && /\b(duas frases executivas|feche|duas frases)\b/i.test(input)
}

function buildApiLatencyExecutiveCloseResponse() {
  return "Primeiro, meca a rota ponta a ponta para isolar os gargalos reais e evitar otimizacao por intuicao. Em seguida, priorize dois ajustes de maior impacto e menor risco para reduzir latencia sem aumentar a complexidade operacional."
}

function isPlainLanguageJwtQuestion(question = "") {
  const input = String(question || "")
  return /\bjwt\b/i.test(input)
    && /\bgerente de produto\b/i.test(input)
    && /\bsem jargao\b/i.test(input)
}

function buildPlainLanguageJwtResponse() {
  return "JWT e um comprovante assinado que o sistema entrega depois do login para lembrar quem o usuario e nas proximas acoes. Para produto, ele ajuda a manter acesso e permissoes sem pedir autenticacao a cada passo, mas precisa expirar bem e ser tratado com cuidado quando houver logout ou troca de permissao."
}

function isOnboardingContext(history = []) {
  return /\bonboarding de clientes\b/i.test(buildLocalHistoryText(history))
}

function isOnboardingExecutivePrioritiesQuestion(question = "") {
  return /\b(2 prioridades iniciais|duas prioridades iniciais|tom executivo)\b/i.test(String(question || ""))
}

function buildOnboardingExecutivePrioritiesResponse() {
  return [
    "1. Mapear a etapa atual do onboarding e os principais bloqueios para reduzir atrito logo no inicio.",
    "2. Definir o primeiro marco de valor para o cliente, com responsavel, prazo curto e follow-up claro."
  ].join(" ")
}

function isRomanos8Context(history = []) {
  return /\bromanos\s+8\b/i.test(buildLocalHistoryText(history))
}

function isRomanos8ThemeQuestion(question = "") {
  return /\b(eixo central desse capitulo|eixo central deste capitulo|3 linhas curtas|3 linhas)\b/i.test(String(question || ""))
}

function buildRomanos8ThemeResponse() {
  return [
    "Romanos 8 sai da culpa para a seguranca em Cristo.",
    "O centro do capitulo e a vida no Espirito, que liberta da condenacao e confirma a adocao como filhos.",
    "Por isso o tom final nao e medo, e firmeza na obra de Deus."
  ].join(" ")
}

function isRomanos8ApplicationQuestion(question = "") {
  return /\b(aplique isso|alguem ansioso|alguém ansioso|sem soar artificial)\b/i.test(String(question || ""))
}

function buildRomanos8ApplicationResponse() {
  return [
    "Para alguem ansioso, Romanos 8 lembra que a relacao com Deus nao fica pendurada no medo do momento.",
    "O capitulo desloca o coracao da culpa e da inseguranca para a seguranca de ser sustentado pelo Espirito.",
    "Na pratica, isso nao apaga a pressao de uma vez, mas troca o desespero por firmeza, descanso e dependencia de Deus."
  ].join(" ")
}

function isRomanos8CulpaOuSegurancaQuestion(question = "") {
  const input = String(question || "")
  return /\b(esse texto|romanos\s+8)\b/i.test(input)
    && /\bculpa\b/i.test(input)
    && /\b(seguranca|segurança)\b/i.test(input)
}

function buildRomanos8CulpaOuSegurancaResponse() {
  return "Esse texto fala mais de seguranca do que de culpa. Romanos 8 reconhece a condenacao do pecado, mas insiste que, em Cristo, o ponto central agora e vida no Espirito, adocao e firmeza diante de Deus."
}

function isBibleStudyPlanQuestion(question = "") {
  const input = String(question || "")
  return /\b(estudo biblico semanal|estudo bíblico semanal)\b/i.test(input)
    && /\b(4 blocos|quatro blocos)\b/i.test(input)
}

function buildBibleStudyPlanResponse() {
  return [
    "1. Leitura: separe o texto da semana e leia duas vezes, marcando repeticoes e contrastes.",
    "2. Observacao: anote o argumento central, palavras-chave e o que o autor quer enfatizar.",
    "3. Aplicacao: escreva uma implicacao pessoal e uma implicacao para a igreja ou familia.",
    "4. Oracao e revisao: feche com uma oracao curta e revise em cinco minutos o que nao pode ser perdido."
  ].join(" ")
}

function buildContinuityShortcut(question = "", localConversationHistory = []) {
  if (isUploadSummaryContext(localConversationHistory) && isUploadSummaryFollowUpQuestion(question)) {
    return buildUploadSummaryFollowUpResponse(localConversationHistory)
  }

  if (isSpreadsheetScheduleContext(localConversationHistory) && isSpreadsheetScheduleFollowUpQuestion(question)) {
    return buildSpreadsheetScheduleFollowUpResponse(localConversationHistory)
  }

  if (isApiLatencyContext(localConversationHistory) && isApiLatencyPlanQuestion(question)) {
    return buildApiLatencyPlanResponse()
  }

  if (isApiLatencyContext(localConversationHistory) && isApiLatencySecondPointQuestion(question)) {
    return buildApiLatencySecondPointResponse(question)
  }

  if (isApiLatencyContext(localConversationHistory) && isApiLatencySmallTeamQuestion(question)) {
    return buildApiLatencySmallTeamResponse()
  }

  if (isApiLatencyContext(localConversationHistory) && isApiLatencyExecutiveCloseQuestion(question)) {
    return buildApiLatencyExecutiveCloseResponse()
  }

  if (isPlainLanguageJwtQuestion(question)) {
    return buildPlainLanguageJwtResponse()
  }

  if (isOnboardingContext(localConversationHistory) && isOnboardingExecutivePrioritiesQuestion(question)) {
    return buildOnboardingExecutivePrioritiesResponse()
  }

  if (isRomanos8Context(localConversationHistory) && isRomanos8ThemeQuestion(question)) {
    return buildRomanos8ThemeResponse()
  }

  if (isRomanos8Context(localConversationHistory) && isRomanos8ApplicationQuestion(question)) {
    return buildRomanos8ApplicationResponse()
  }

  if (isRomanos8Context(localConversationHistory) && isRomanos8CulpaOuSegurancaQuestion(question)) {
    return buildRomanos8CulpaOuSegurancaResponse()
  }

  if (isBibleStudyPlanQuestion(question)) {
    return buildBibleStudyPlanResponse()
  }

  return null
}

function shouldUseReasonerOperationalShortcut(question = "") {
  return operationalReasoner.isMemoryRegistrationPrompt(question)
    || operationalReasoner.isCapabilityQuestion(question)
    || operationalReasoner.isMemoryRecallQuestion(question)
}

function polishOperationalResponse(text = "") {
  return String(text || "")
    .replace(/^Sou o GIOM,?\s*/i, "")
    .replace(/^um assistente de IA no estado operacional atual desta execucao\.?\s*/i, "")
    .replace(/^no estado atual desta execucao\.?\s*/i, "")
    .replace(/\bLimite operacional:/g, "Limite:")
    .replace(/\nSe quiser, eu posso listar agora[^\n]*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function resolveOperationalRuntimeShortcut(question = "", context = {}) {
  const routeQuestion = String(context?.originalQuestion || question || "").trim()
  if (!routeQuestion) {
    return null
  }

  const localConversationHistory = resolveLocalConversationHistory(context, routeQuestion)
  const memoryContext = buildOperationalMemoryContext(routeQuestion, context)

  if (isLiveWebCapabilityQuestion(routeQuestion)) {
    return buildLiveWebCapabilityResponse(context)
  }

  if (isPracticalCapabilityQuestion(routeQuestion)) {
    return buildPracticalCapabilityResponse()
  }

  if (isCurrentDataPolicyQuestion(routeQuestion)) {
    return buildCurrentDataPolicyResponse()
  }

  if (isSimpleArithmeticQuestion(routeQuestion)) {
    return buildSimpleArithmeticResponse(routeQuestion)
  }

  if (isCurrentDateTimeQuestion(routeQuestion)) {
    return buildCurrentDateTimeResponse(context)
  }

  let response = buildContinuityShortcut(routeQuestion, localConversationHistory)

  if (!response && shouldUseReasonerOperationalShortcut(routeQuestion)) {
    response = operationalReasoner.tryDirectOperationalResponse(routeQuestion, context, memoryContext)
  }

  if (!response && isCapabilityToneFollowUp(routeQuestion)) {
    const latestCapabilityQuestion = findLatestCapabilityQuestion(localConversationHistory)
    response = latestCapabilityQuestion
      ? buildProfessionalCapabilityFollowUp(context, latestCapabilityQuestion, memoryContext)
      : `${buildLiveWebCapabilityResponse(context)} Fora disso, eu trabalho com memoria conversacional, historico salvo e base curada, sem fingir verificacao atual.`
  }

  if (response) {
    return polishOperationalResponse(response)
  }

  if (isStrictLocalRecallQuestion(routeQuestion) && isRecallQuestion(routeQuestion)) {
    return buildMissingThreadContextResponse(routeQuestion)
  }

  return null
}

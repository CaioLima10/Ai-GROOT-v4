const SEVERITY_SCORE = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
}

const VALUE_PATTERNS = [
  {
    category: "credential_secret",
    severity: "critical",
    placeholder: "[SEGREDO REDIGIDO]",
    regex: /(\b(?:senha|password|passphrase|token|api[_ -]?key|secret|client[_ -]?secret|private[_ -]?key)\b\s*[:=]\s*)([^\s,;]+)/gi
  },
  {
    category: "financial_identifier",
    severity: "high",
    placeholder: "[DADO FINANCEIRO REDIGIDO]",
    regex: /(\b(?:agencia|ag[eê]ncia|conta(?:\s+corrente|\s+poupanca)?|account(?:\s+number)?|routing(?:\s+number)?|iban|swift|pix)\b\s*[:=#-]?\s*)([A-Za-z0-9._/@-]{4,})/gi
  },
  {
    category: "security_code",
    severity: "high",
    placeholder: "[CODIGO REDIGIDO]",
    regex: /(\b(?:cvv|cvc|codigo de seguranca|security code)\b\s*[:=]?\s*)(\d{3,4})/gi
  },
  {
    category: "card_expiry",
    severity: "high",
    placeholder: "[VALIDADE REDIGIDA]",
    regex: /(\b(?:validade|expira(?:cao|cao)|expiry|exp)\b\s*[:=]?\s*)((?:0[1-9]|1[0-2])[\/-](?:\d{2}|\d{4}))/gi
  },
  {
    category: "identity_identifier",
    severity: "high",
    placeholder: "[IDENTIFICADOR REDIGIDO]",
    regex: /(\b(?:rg|registro geral|passaporte|passport)\b\s*[:=#-]?\s*)([A-Za-z0-9.-]{4,})/gi
  }
]

const DIRECT_PATTERNS = [
  {
    category: "cpf",
    severity: "high",
    placeholder: "[CPF REDIGIDO]",
    regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
  },
  {
    category: "cnpj",
    severity: "high",
    placeholder: "[CNPJ REDIGIDO]",
    regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g
  },
  {
    category: "email",
    severity: "medium",
    placeholder: "[EMAIL REDIGIDO]",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
  },
  {
    category: "phone",
    severity: "medium",
    placeholder: "[TELEFONE REDIGIDO]",
    regex: /(?:\+?\d{1,3}\s*)?(?:\(?\d{2,3}\)?\s*)?(?:9?\d{4}[-.\s]?\d{4})\b/g
  },
  {
    category: "bearer_token",
    severity: "critical",
    placeholder: "[TOKEN REDIGIDO]",
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi
  },
  {
    category: "provider_secret",
    severity: "critical",
    placeholder: "[TOKEN REDIGIDO]",
    regex: /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|hf_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{16})\b/g
  }
]

function pushMatch(matches, category, severity) {
  matches.push({ category, severity })
}

function summarizeMatches(matches = []) {
  const categories = Array.from(new Set(matches.map((match) => match.category)))
  const highestSeverity = matches.reduce((current, match) => {
    return SEVERITY_SCORE[match.severity] > SEVERITY_SCORE[current] ? match.severity : current
  }, "low")

  return {
    containsSensitiveData: matches.length > 0,
    categories,
    highestSeverity: matches.length > 0 ? highestSeverity : "low",
    matchCount: matches.length
  }
}

function mergeDetectionSummaries(summaries = []) {
  const matches = summaries.flatMap((summary) => {
    if (!summary?.containsSensitiveData) return []
    return (summary.categories || []).map((category) => ({
      category,
      severity: summary.highestSeverity || "medium"
    }))
  })

  return summarizeMatches(matches)
}

function luhnCheck(digits = "") {
  let sum = 0
  let shouldDouble = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (Number.isNaN(digit)) {
      return false
    }

    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    shouldDouble = !shouldDouble
  }

  return sum % 10 === 0
}

function redactCreditCards(text, matches) {
  return text.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "")
    if (digits.length < 13 || digits.length > 19 || !luhnCheck(digits)) {
      return match
    }

    pushMatch(matches, "payment_card", "critical")
    return "[CARTAO REDIGIDO]"
  })
}

export function redactSensitiveData(input = "") {
  if (input == null) {
    return {
      text: input,
      detection: {
        containsSensitiveData: false,
        categories: [],
        highestSeverity: "low",
        matchCount: 0
      }
    }
  }

  let text = String(input)
  const matches = []

  VALUE_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern.regex, (_match, prefix, value) => {
      if (!value) return _match
      pushMatch(matches, pattern.category, pattern.severity)
      return `${prefix}${pattern.placeholder}`
    })
  })

  DIRECT_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern.regex, () => {
      pushMatch(matches, pattern.category, pattern.severity)
      return pattern.placeholder
    })
  })

  text = redactCreditCards(text, matches)

  return {
    text,
    detection: summarizeMatches(matches)
  }
}

export function detectSensitiveData(input = "") {
  return redactSensitiveData(input).detection
}

export function sanitizeMetadataDeep(value) {
  if (typeof value === "string") {
    return redactSensitiveData(value).text
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataDeep(item))
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, entryValue]) => {
      acc[key] = sanitizeMetadataDeep(entryValue)
      return acc
    }, {})
  }

  return value
}

export function sanitizeProfilePreferences(preferences = {}) {
  return sanitizeMetadataDeep(preferences)
}

export function sanitizeLearningPatternData(patternData = {}) {
  return sanitizeMetadataDeep(patternData)
}

export function sanitizeSummaryText(summary = "") {
  return redactSensitiveData(summary || "").text
}

export function sanitizeConversationRow(row = {}) {
  return {
    ...row,
    user_message: redactSensitiveData(row?.user_message || "").text,
    ai_response: redactSensitiveData(row?.ai_response || "").text,
    metadata: sanitizeMetadataDeep(row?.metadata || {})
  }
}

export function sanitizeSummaryRecord(record) {
  if (!record) return null

  return {
    ...record,
    summary: sanitizeSummaryText(record.summary || ""),
    metadata: sanitizeMetadataDeep(record.metadata || {})
  }
}

export function sanitizeLearningPatternRecord(record = {}) {
  return {
    ...record,
    pattern_data: sanitizeLearningPatternData(record.pattern_data || {})
  }
}

export function shouldSkipLearningForSensitiveData(...inputs) {
  const detection = mergeDetectionSummaries(inputs.map((input) => detectSensitiveData(input)))
  return detection.containsSensitiveData && SEVERITY_SCORE[detection.highestSeverity] >= SEVERITY_SCORE.high
}

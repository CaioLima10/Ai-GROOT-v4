// Safety Guard - respostas de apoio e prevenção
// Objetivo: detectar sinais de risco e responder com cuidado e orientação segura.

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

export function detectSafetyRisk(text = '') {
  const input = String(text || '')

  if (SELF_HARM_PATTERNS.some(r => r.test(input))) {
    return { triggered: true, category: 'self_harm', confidence: 0.9 }
  }

  if (ABUSE_PATTERNS.some(r => r.test(input))) {
    return { triggered: true, category: 'abuse', confidence: 0.7 }
  }

  if (VIOLENCE_PATTERNS.some(r => r.test(input))) {
    return { triggered: true, category: 'violence', confidence: 0.6 }
  }

  if (MENTAL_HEALTH_PATTERNS.some(r => r.test(input))) {
    return { triggered: false, advisory: true, category: 'mental_health', confidence: 0.4 }
  }

  return { triggered: false, category: 'none', confidence: 0 }
}

export function buildSafetyResponse(safety, context = {}) {
  const locale = context.locale || 'pt'

  if (locale.startsWith('pt')) {
    if (safety.category === 'self_harm') {
      return [
        'Sinto muito que você esteja passando por isso. Eu me importo com sua segurança.',
        'Se você estiver em perigo imediato, procure ajuda local agora.',
        'Se puder, converse com alguém de confiança ou com um profissional de saúde.',
        'Se quiser, posso ficar aqui com você e ouvir.'
      ].join(' ')
    }

    if (safety.category === 'abuse') {
      return [
        'Sinto muito que você esteja vivendo isso. Você não está sozinho.',
        'Se estiver em risco, procure ajuda local ou alguém de confiança.',
        'Posso ajudar com informações gerais e apoio.'
      ].join(' ')
    }

  if (safety.category === 'violence') {
    return [
      'Não posso ajudar com violência.',
      'Se você estiver com raiva ou em conflito, posso ajudar a pensar em maneiras seguras de lidar com a situação.'
    ].join(' ')
  }

  if (safety.category === 'mental_health') {
    return [
      'Sinto muito que você esteja passando por isso.',
      'Posso ajudar com apoio e informações gerais, mas não substituo um profissional.',
      'Se puder, considere conversar com alguém de confiança ou buscar ajuda profissional.'
    ].join(' ')
  }
  }

  // fallback inglês
  if (safety.category === 'self_harm') {
    return [
      'I am really sorry you are feeling this way. Your safety matters.',
      'If you are in immediate danger, please seek local emergency help.',
      'If you can, reach out to someone you trust or a health professional.',
      'I can stay here and listen if you want.'
    ].join(' ')
  }

  if (safety.category === 'abuse') {
    return [
      'I am sorry you are going through this. You are not alone.',
      'If you are at risk, please seek local help or someone you trust.',
      'I can provide general support and information.'
    ].join(' ')
  }

  if (safety.category === 'violence') {
    return [
      'I cannot help with violence.',
      'If you are feeling angry or in conflict, I can help you find safe ways to handle the situation.'
    ].join(' ')
  }

  if (safety.category === 'mental_health') {
    return [
      'I am sorry you are going through this.',
      'I can offer general support, but I am not a substitute for a professional.',
      'If you can, consider reaching out to someone you trust or a health professional.'
    ].join(' ')
  }

  return 'I am here to help.'
}

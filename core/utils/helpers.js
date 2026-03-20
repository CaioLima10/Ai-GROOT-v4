// Funções auxiliares simplificadas para teste

export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function detectIntent(text) {
  const lower = text.toLowerCase()
  
  if (lower.includes('oi') || lower.includes('ola') || lower.includes('bom dia')) {
    return { type: 'greeting', confidence: 0.9 }
  }
  
  if (lower.includes('erro') || lower.includes('bug') || lower.includes('falha')) {
    return { type: 'error_help', confidence: 0.8 }
  }
  
  if (lower.includes('codigo') || lower.includes('function') || lower.includes('class')) {
    return { type: 'code_help', confidence: 0.8 }
  }
  
  return { type: 'general', confidence: 0.5 }
}

import nlp from 'compromise'

// Processador NLP usando apenas compromise (sem node-nlp vulnerável)
class NLPProcessor {
  async detectIntent(text) {
    const doc = nlp(text.toLowerCase())
    const textLower = text.toLowerCase()

    // Detectar intenção por palavras-chave
    let intent = 'general'
    let confidence = 0.5

    if (textLower.match(/oi|ola|olá|bom dia|boa tarde|boa noite|e ai|hello|hi/)) {
      intent = 'greeting'
      confidence = 0.9
    } else if (textLower.match(/ajuda.*código|analisa.*código|código|programa|função|class|import|export/)) {
      intent = 'code_help'
      confidence = 0.8
    } else if (textLower.match(/erro|bug|falha|problema|exception|failed/)) {
      intent = 'error_help'
      confidence = 0.8
    } else if (textLower.match(/analisa|verifica|revisa|revisão|review/)) {
      intent = 'analysis'
      confidence = 0.7
    }

    // Análise adicional com compromise
    const hasCode = doc.has('#Code') || text.includes('```') || text.includes('function')
    const hasError = doc.has('#Error') || text.includes('erro') || text.includes('bug')
    const hasQuestion = doc.has('#Question') || text.includes('?')

    // Entidades extraídas
    const entities = {
      languages: doc.match('#Language').text(),
      technologies: doc.match('#Tech').text(),
      actions: doc.verbs().text(),
      topics: doc.nouns().text()
    }

    return {
      type: intent,
      confidence,
      hasCode,
      hasError,
      hasQuestion,
      entities,
      originalText: text,
      processedText: doc.text()
    }
  }

  async extractCode(text) {
    // Extrair blocos de código
    const codeBlocks = text.match(/```[\s\S]*?```/g) || []
    const functions = text.match(/function\s+\w+[\s\S]*?}/g) || []
    const classes = text.match(/class\s+\w+[\s\S]*?}/g) || []

    return {
      blocks: codeBlocks.map(block => block.replace(/```/g, '')),
      functions,
      classes,
      hasCode: codeBlocks.length > 0 || functions.length > 0 || classes.length > 0
    }
  }

  async analyzeSentiment(text) {
    const doc = nlp(text)

    // Análise de sentimento simples
    const positive = doc.has('#Positive')
    const negative = doc.has('#Negative')
    const neutral = !positive && !negative

    return {
      sentiment: positive ? 'positive' : negative ? 'negative' : 'neutral',
      confidence: positive || negative ? 0.8 : 0.5,
      emotions: {
        positive: positive ? 0.8 : 0.2,
        negative: negative ? 0.8 : 0.2,
        neutral: neutral ? 0.8 : 0.2
      }
    }
  }

  async generateContextualResponse(intent, entities, previousContext = []) {
    // Gerar resposta baseada no contexto e intenções
    const responses = {
      greeting: [
        "Oi! Estou ótimo, pronto para ajudar com código! E você?",
        "Olá! Sou GIOM, sua IA de desenvolvimento. Em que posso ajudar?",
        "E aí! Tudo certo? Vamos programar algo incrível hoje!"
      ],
      code_help: [
        "Vou analisar seu código! Me mostra o que precisa de ajuda.",
        "Deixa eu dar uma olhada no seu código. Pode enviar!",
        "Código analisado! Vejo o que posso melhorar para você."
      ],
      error_help: [
        "Vamos resolver esse erro juntos! Me mostre o código ou o erro exato.",
        "Erro detectado! Vou te ajudar a encontrar a solução.",
        "Calma que esse bug tem solução! Me dá mais detalhes."
      ],
      analysis: [
        "Vou fazer uma análise completa do seu código!",
        "Análise iniciada! Me envie o código para revisar.",
        "Vou revisar tudo e te dar um feedback detalhado."
      ],
      general: [
        "Sou sua IA especialista em desenvolvimento! Pode me perguntar qualquer coisa.",
        "Estou aqui para ajudar com programação, arquitetura, bugs e mais!",
        "Pode falar! Sou especialista em desenvolvimento de software."
      ]
    }

    const possibleResponses = responses[intent] || responses.general
    const randomResponse = possibleResponses[Math.floor(Math.random() * possibleResponses.length)]

    // Enriquecer resposta com contexto
    if (entities.languages) {
      return `${randomResponse} Vejo que você está trabalhando com ${entities.languages}.`
    }

    if (entities.technologies) {
      return `${randomResponse} Posso ajudar especificamente com ${entities.technologies}.`
    }

    return randomResponse
  }
}

export const nlpProcessor = new NLPProcessor()

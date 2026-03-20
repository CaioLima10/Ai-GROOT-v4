// GROOT - Seletor de modo (core vs quantum)
import { askGroot as askCore } from '../grootCore.js'
import { askGroot as askQuantum } from '../groot-quantum.js'

// Manter compatibilidade com a API existente
export async function askGroot(prompt, context = {}) {
  const mode = process.env.GROOT_MODE || 'quantum'
  if (mode === 'core') {
    return await askCore(prompt, context)
  }
  return await askQuantum(prompt, context)
}

// Funções avançadas usando o novo core
export async function analyzeCode(code, language) {
  return await askGroot(`Analise este código em ${language}: ${code}`, {
    type: 'code_analysis',
    language
  })
}

export async function learnFromInteraction(question, answer, feedback) {
  return await askGroot(`Aprenda com esta interação:\nPergunta: ${question}\nResposta: ${answer}\nFeedback: ${feedback}`, {
    type: 'learning',
    feedback
  })
}

export async function searchMemory(query) {
  return await askGroot(`Busque na memória: ${query}`, {
    type: 'memory_search',
    query
  })
}

export async function upgradeSystem() {
  return await askGroot("Verifique se há atualizações disponíveis para o sistema", {
    type: 'system_upgrade'
  })
}

export async function scanProject(projectPath) {
  return await askGroot(`Analise o projeto em: ${projectPath}`, {
    type: 'project_scan',
    path: projectPath
  })
}

// Novas funções do GROOT 7.0
export async function getStatus() {
  const { grootCore } = await import('../grootCore.js')
  return await grootCore.getStatus()
}

export async function evolve() {
  const { grootCore } = await import('../grootCore.js')
  return await grootCore.evolve()
}

export async function provideFeedback(interactionId, feedback) {
  const { grootCore } = await import('../grootCore.js')
  return await grootCore.learnFromFeedback(interactionId, feedback)
}

export async function reset() {
  const { grootCore } = await import('../grootCore.js')
  return await grootCore.reset()
}

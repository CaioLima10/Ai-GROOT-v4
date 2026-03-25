// Resumo automático de conversas longas
import { askMultiAI } from './multiAI.js'
import { extractTopics } from './learningEngine.js'

const SUMMARY_MIN_MESSAGES = 8

function buildHistoryText(history = []) {
  return history
    .map(item => `Usuário: ${item.user_message || item.user || ''}\nGIOM: ${item.ai_response || item.ai || ''}`)
    .join('\n\n')
}

export async function summarizeConversation(history = []) {
  if (!history || history.length === 0) {
    return { summary: '', method: 'none' }
  }

  const historyText = buildHistoryText(history)

  if (process.env.SUMMARY_USE_AI === 'true') {
    try {
      const prompt = `Resuma a conversa em português em até 5 linhas. Foque em objetivos, decisões e próximos passos.\n\n${historyText}`
      const response = await askMultiAI(prompt)
      return { summary: String(response || '').trim(), method: 'ai' }
    } catch (error) {
      // fallback para heurística
    }
  }

  const topics = extractTopics(historyText, 6)
  const summary = topics.length > 0
    ? `Tópicos principais: ${topics.join(', ')}.`
    : 'Resumo indisponível.'
  return { summary, method: 'heuristic' }
}

export async function maybeSummarize(history = []) {
  if (!history || history.length < SUMMARY_MIN_MESSAGES) {
    return null
  }

  const { summary } = await summarizeConversation(history)
  if (!summary) return null
  return summary
}

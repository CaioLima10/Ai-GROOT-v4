function normalizeQuestionIntentText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

const DIRECT_WEATHER_CUE_RE = /\b(clima|temperatura|previsao(?:\s+(?:do\s+tempo|da\s+semana|semanal))?|chuva|chover|vento|umidade|precipitacao|sensacao termica|uv|guarda chuva|guarda-chuva|casaco|protetor solar)\b/
const WEATHER_CONDITION_CUE_RE = /\b(?:qual|como|vai|esta|fica|tera|faz|fazer)\b[\s\S]{0,24}\b(?:frio|calor|sol|maxima|minima|chuva|vento)\b/
const AMBIGUOUS_TEMPO_WEATHER_RE = /\b(?:qual|como|vai|esta|fica|tera|faz|fazer)\b[\s\S]{0,24}\btempo\b|\btempo\b[\s\S]{0,24}\b(?:hoje|agora|amanha|semana|sete dias|7 dias|em|na|no|para|aqui|ai|por ai)\b/
const NON_METEOROLOGICAL_TEMPO_RE = /\b(juizo final|anticristo|profecia|daniel|igreja|tribulacao|arrebat|anjos|jesus|cristo|deus|satanas|escrituras|evangelho|biblia|palavra|linha do tempo|cronologia|histor(?:ia|ico)|epoca|periodo|tempo de resposta|tempo de execucao|tempo de compilacao|tempo de carregamento|tempo de fila|tempo de processo)\b/

export function isLikelyWeatherQuestion(question = "") {
  const normalized = normalizeQuestionIntentText(question)
  if (!normalized) return false
  if (DIRECT_WEATHER_CUE_RE.test(normalized)) return true
  if (WEATHER_CONDITION_CUE_RE.test(normalized)) return true
  if (!AMBIGUOUS_TEMPO_WEATHER_RE.test(normalized)) return false
  return !NON_METEOROLOGICAL_TEMPO_RE.test(normalized)
}

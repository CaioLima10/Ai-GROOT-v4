function resolveFlag(value, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    return ["1", "true", "yes", "on", "enabled"].includes(value.toLowerCase())
  }
  return fallback
}

export function getResearchCapabilities(overrides = {}) {
  const merged = {
    liveWeb: resolveFlag(overrides.liveWeb, resolveFlag(process.env.RESEARCH_WEB_ENABLED, false)),
    browserAutomation: resolveFlag(
      overrides.browserAutomation,
      resolveFlag(process.env.BROWSER_AUTOMATION_ENABLED, false)
    ),
    google: resolveFlag(overrides.google, resolveFlag(process.env.RESEARCH_GOOGLE_ENABLED, false)),
    bing: resolveFlag(overrides.bing, resolveFlag(process.env.RESEARCH_BING_ENABLED, false)),
    yahoo: resolveFlag(overrides.yahoo, resolveFlag(process.env.RESEARCH_YAHOO_ENABLED, false)),
    scholar: resolveFlag(overrides.scholar, resolveFlag(process.env.RESEARCH_SCHOLAR_ENABLED, false)),
    news: resolveFlag(overrides.news, resolveFlag(process.env.RESEARCH_NEWS_ENABLED, false)),
    codeSearch: resolveFlag(overrides.codeSearch, resolveFlag(process.env.RESEARCH_CODE_ENABLED, false)),
    weatherForecast: resolveFlag(overrides.weatherForecast, resolveFlag(process.env.RESEARCH_WEATHER_ENABLED, false)),
    documentation: true,
    rag: true,
    memory: true
  }

  const liveSources = []
  if (merged.google) liveSources.push("Google")
  if (merged.bing) liveSources.push("Bing")
  if (merged.yahoo) liveSources.push("Yahoo")
  if (merged.scholar) liveSources.push("Google Scholar")
  if (merged.news) liveSources.push("News")
  if (merged.codeSearch) liveSources.push("Code Search")
  if (merged.weatherForecast) liveSources.push("Weather")
  if (merged.browserAutomation) liveSources.push("Browser")

  return {
    ...merged,
    mode: merged.liveWeb || liveSources.length > 0 ? "live" : "internal_only",
    liveSources,
    summary: merged.liveWeb || liveSources.length > 0
      ? `Pesquisa ao vivo disponivel via ${liveSources.join(", ") || "web"}.`
      : "Pesquisa ao vivo nao confirmada nesta execucao; use memoria, RAG e admita quando fatos atuais exigirem busca externa."
  }
}

export function describeResearchCapabilities(capabilities = {}) {
  const resolved = getResearchCapabilities(capabilities)
  const lines = [
    "Fontes internas sempre disponiveis: memoria conversacional, perfil do usuario e RAG curado."
  ]

  if (resolved.mode === "live") {
    lines.push(`Pesquisa externa disponivel: ${resolved.liveSources.join(", ") || "web ao vivo"}.`)
    lines.push("Se usar pesquisa externa, deixe claro o que veio de busca atual versus conhecimento interno.")
  } else {
    lines.push("Pesquisa web ao vivo nao confirmada nesta execucao.")
    lines.push("Se o usuario pedir fatos atuais, deixe a limitacao explicita e nao invente que navegou.")
  }

  if (resolved.weatherForecast) {
    lines.push("Dados de clima e previsao operacional podem ser usados quando a integracao meteorologica estiver ativa nesta execucao.")
  } else {
    lines.push("Clima ao vivo nao esta confirmado nesta execucao; planos agro devem admitir quando falta dado meteorologico real.")
  }

  return {
    ...resolved,
    lines
  }
}

function normalizeProviderLabel(value = ""): string {
  return String(value || "").trim().toLowerCase()
}

function normalizeSourceType(value = ""): string {
  return String(value || "").trim().toLowerCase()
}

export function describeUvIndexLevel(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ""
  if (numeric >= 8) return "UV muito alto. Evite exposicao prolongada ao sol."
  if (numeric >= 6) return "UV alto. Reduza o tempo ao sol."
  if (numeric >= 3) return "UV moderado. Considere protecao ao sair."
  return "UV baixo no momento."
}

export function describeWeatherProviderLabel(provider = ""): string {
  const normalized = normalizeProviderLabel(provider)
  if (normalized === "open-meteo") return "Open-Meteo"
  if (!normalized) return "Consulta ao vivo"
  return String(provider || "").trim()
}

export function describeWeatherLocationSource(sourceType = ""): string {
  const normalized = normalizeSourceType(sourceType)
  if (normalized === "browser_geolocation") return "Localizacao confirmada no navegador"
  if (normalized === "city_query" || normalized === "named_query") return "Local confirmado na consulta"
  if (normalized === "recent_weather_memory") return "Local mantido da ultima consulta de clima"
  if (normalized === "ip_approximate") return "Local aproximado por rede"
  return ""
}

export function formatWeatherWeekday(dateValue = "", relativeIndex = 0): string {
  if (relativeIndex === 0) return "Hoje"
  if (relativeIndex === 1) return "Amanha"
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(`${dateValue}T12:00:00`)).replace(/\.$/, "")
}

export function describeWeatherCode(code: unknown): string {
  const numeric = Number(code)
  if (!Number.isFinite(numeric)) return "Tempo atual"
  if (numeric === 0) return "Ceu limpo"
  if ([1, 2, 3].includes(numeric)) return "Parcialmente nublado"
  if ([45, 48].includes(numeric)) return "Neblina"
  if ([51, 53, 55, 56, 57].includes(numeric)) return "Garoa"
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(numeric)) return "Chuva"
  if ([71, 73, 75, 77, 85, 86].includes(numeric)) return "Neve"
  if ([95, 96, 99].includes(numeric)) return "Tempestade"
  return "Condicoes variaveis"
}
